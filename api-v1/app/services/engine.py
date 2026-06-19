from datetime import date, datetime, time, timezone
from typing import Any

from app.core.config import get_settings
from app.schemas.api_models import TradingMode, TradingStrategy
from app.schemas.prop_firm import PropFirmRules
from app.services.app_logger import AppLogger
from app.services.executor import Executor
from app.services.llm_engine import LLMEngine
from app.services.market_snapshot import MarketSnapshotService
from app.services.mt5_connector import MT5Connector
from app.services.cycle_gate import CycleRunGate
from app.services.scheduler import CandleScheduler
from app.schemas.api_models import TradingAccountMode
from app.db.session import session_scope
from app.services.trading_cycle import (
    execute_decision_with_compliance,
    record_trading_run,
    resolve_prop_firm_for_account_mode,
)


class TradingEngine:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.logger = AppLogger()
        self.mt5 = MT5Connector()
        self.snapshot_service = MarketSnapshotService()
        self.llm = LLMEngine()
        self.executor = Executor(self.mt5)
        self.scheduler = CandleScheduler(self.settings.poll_interval_seconds)
        self.run_lock = CycleRunGate()

    def connect(self, login: str | None, password: str | None, server: str | None) -> tuple[bool, str]:
        ok, msg = self.mt5.connect(login, password, server)
        self.logger.info("orders", "connect_attempt", ok=ok)
        return ok, msg

    def disconnect(self) -> tuple[bool, str]:
        ok, msg = self.mt5.disconnect()
        self.logger.info("orders", "disconnect", ok=ok)
        return ok, msg

    def get_status(self, symbol: str | None = None) -> dict:
        selected_symbol = (symbol or "").strip() or None
        base = {"connected": self.mt5.connected, "demo_only": self.settings.mt5_demo_only}
        if not self.mt5.connected:
            return base

        timeframe = self.settings.trade_timeframe
        payload: dict = {**base, "timeframe": timeframe}

        try:
            payload["account"] = self.mt5.get_account_info()
        except Exception as exc:
            payload["error"] = str(exc)
            return payload

        try:
            payload["positions"] = self.mt5.get_positions(selected_symbol)
        except Exception:
            payload["positions"] = []

        if selected_symbol:
            payload["symbol"] = selected_symbol
            try:
                payload["tick"] = self.mt5.get_tick(selected_symbol)
            except Exception:
                pass

        return payload

    def get_trade_history(
        self,
        limit: int = 200,
        offset: int = 0,
        lookback_days: int = 30,
        symbol: str | None = None,
        outcome_filter: str = "all",
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> dict:
        selected_symbol = (symbol or "").strip() or None
        self.ensure_connected()
        if date_from and date_to and date_from > date_to:
            raise ValueError("Start date must be before end date.")

        resolved_date_from = (
            datetime.combine(date_from, time.min, tzinfo=timezone.utc) if date_from is not None else None
        )
        resolved_date_to = (
            datetime.combine(date_to, time.max, tzinfo=timezone.utc) if date_to is not None else None
        )
        history = self.mt5.get_trade_history(
            limit=limit,
            offset=offset,
            lookback_days=lookback_days,
            symbol=selected_symbol,
            outcome_filter=outcome_filter,
            date_from=resolved_date_from,
            date_to=resolved_date_to,
        )
        return {
            "items": history["items"],
            "count": len(history["items"]),
            "total_count": history["total_count"],
            "limit": limit,
            "offset": offset,
            "lookback_days": lookback_days,
            "symbol": selected_symbol,
            "outcome_filter": outcome_filter,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
        }

    def get_equity_curve(self, lookback_days: int = 30) -> dict:
        self.ensure_connected()
        return self.mt5.get_equity_curve(lookback_days=lookback_days)

    def ask_position_insight(
        self,
        provider: str,
        question: str,
        model: str | None = None,
        stream_handler: Any | None = None,
    ) -> dict:
        self.ensure_connected()
        positions = self.mt5.get_positions()
        account = self.mt5.get_account_info()
        symbols = sorted({str(position.get("symbol")) for position in positions if position.get("symbol")})
        timeframe = self.settings.trade_timeframe

        ticks: dict[str, Any] = {}
        market_snapshots: dict[str, Any] = {}
        for symbol in symbols:
            try:
                tick = self.mt5.get_tick(symbol)
                ticks[symbol] = tick

                candles = self.mt5.get_candles(symbol, timeframe, self.settings.candle_count)
                symbol_positions = [position for position in positions if position.get("symbol") == symbol]
                snapshot = self.snapshot_service.capture(
                    symbol=symbol,
                    timeframe=timeframe,
                    candles=candles,
                    tick=tick,
                    account_info=account,
                    positions=symbol_positions,
                )
                market_snapshots[symbol] = {
                    "timeframe": timeframe,
                    "tick": snapshot.get("tick"),
                    "indicators": snapshot.get("indicators"),
                    "market_context": snapshot.get("market_context"),
                    "recent_candles": snapshot.get("candles", [])[-5:],
                    "position_count": len(symbol_positions),
                    "net_volume": sum(float(position.get("volume") or 0.0) for position in symbol_positions),
                }
            except Exception as exc:
                ticks[symbol] = {"error": str(exc)}
                market_snapshots[symbol] = {"error": str(exc)}

        total_unrealized = sum(float(position.get("profit") or 0.0) for position in positions)
        total_volume = sum(float(position.get("volume") or 0.0) for position in positions)

        context = {
            "account": account,
            "positions": positions,
            "ticks": ticks,
            "market_snapshots": market_snapshots,
            "market_overview": {
                "timeframe": timeframe,
                "symbols": symbols,
                "position_count": len(positions),
                "total_unrealized_profit": total_unrealized,
                "total_open_volume": total_volume,
            },
            "position_count": len(positions),
        }
        answer, prompt, selected_model = self.llm.ask_position_insight(
            context=context,
            question=question,
            provider=provider,
            model=model,
            stream_handler=stream_handler,
        )
        return {
            "provider": provider,
            "model": selected_model,
            "question": question,
            "answer": answer,
            "context": context,
            "prompt": prompt,
        }

    def ensure_connected(self) -> None:
        if not self.mt5.connected:
            raise RuntimeError("Connect MT5 first.")

    def run_cycle(
        self,
        provider: str,
        wait_for_new_candle: bool = True,
        model: str | None = None,
        symbol: str = "EURUSDm",
        trading_mode: TradingMode = "auto",
        trading_strategy: TradingStrategy = "none",
        user_prompt: str | None = None,
        prop_firm_rules: PropFirmRules | None = None,
        prop_firm_profile_id: int | None = None,
        account_mode: str = "real",
        stream_handler: Any | None = None,
        force_llm_stream: bool = False,
    ) -> dict:
        self.ensure_connected()
        selected_provider = self.llm.resolve_provider(provider)
        selected_model = self.llm.resolve_model(selected_provider, model)
        selected_symbol = symbol.strip()
        timeframe = self.settings.trade_timeframe

        if wait_for_new_candle:
            self.scheduler.wait_for_new_closed_candle(
                key=(selected_symbol, timeframe),
                get_last_closed_candle_time=lambda: self.mt5.get_last_closed_candle_time(selected_symbol, timeframe),
            )

        candles = self.mt5.get_candles(selected_symbol, timeframe, self.settings.candle_count)
        tick = self.mt5.get_tick(selected_symbol)
        positions = self.mt5.get_positions(selected_symbol)
        account_info = self.mt5.get_account_info()

        snapshot = self.snapshot_service.capture(
            symbol=selected_symbol,
            timeframe=timeframe,
            candles=candles,
            tick=tick,
            account_info=account_info,
            positions=positions,
        )
        self.logger.log_snapshot(snapshot)

        mode: TradingAccountMode = (
            account_mode if account_mode in ("real", "demo", "prop_firm") else "real"
        )
        with session_scope() as db:
            effective_prop_rules, effective_profile_id = resolve_prop_firm_for_account_mode(
                db,
                account_mode=mode,
                inline_rules=prop_firm_rules,
                profile_id=prop_firm_profile_id,
            )

        decision, prompt, raw_response = self.llm.decide(
            snapshot,
            provider=selected_provider,
            model=selected_model,
            trading_mode=trading_mode,
            trading_strategy=trading_strategy,
            user_prompt=user_prompt,
            prop_firm_rules=effective_prop_rules,
            stream_handler=stream_handler,
            force_stream=force_llm_stream,
        )
        self.logger.log_decision(
            {
                "provider": selected_provider,
                "model": selected_model,
                "trading_mode": trading_mode,
                "trading_strategy": trading_strategy,
                "user_prompt": user_prompt,
                "symbol": selected_symbol,
                "prompt": prompt,
                "raw_response": raw_response,
                "parsed_decision": decision.model_dump(),
            }
        )

        execution, executed, compliance, resolved_profile_id = execute_decision_with_compliance(
            self,
            decision=decision,
            symbol=selected_symbol,
            snapshot=snapshot,
            account_info=account_info,
            open_position_count=len(positions),
            prop_firm_rules=prop_firm_rules,
            prop_firm_profile_id=prop_firm_profile_id,
            should_execute=True,
            account_mode=mode,
        )
        exit_feedback = self.executor.collect_exit_feedback(selected_symbol)
        run_id = record_trading_run(
            self,
            run_type="single_agent",
            symbol=selected_symbol,
            trading_mode=trading_mode,
            trading_strategy=trading_strategy,
            snapshot=snapshot,
            decision=decision,
            execution=execution,
            executed=executed,
            compliance=compliance,
            prop_firm_profile_id=resolved_profile_id,
            provider=selected_provider,
            model=selected_model,
            user_prompt=user_prompt,
            raw_response=raw_response,
        )
        self.logger.log_order(
            {
                "provider": selected_provider,
                "model": selected_model,
                "trading_mode": trading_mode,
                "trading_strategy": trading_strategy,
                "user_prompt": user_prompt,
                "symbol": selected_symbol,
                "decision": decision.model_dump(),
                "execution": execution,
                "exit_feedback": exit_feedback,
                "compliance": compliance.summary,
                "run_id": run_id,
            }
        )
        return {
            "wait_for_new_candle": wait_for_new_candle,
            "provider": selected_provider,
            "model": selected_model,
            "trading_mode": trading_mode,
            "trading_strategy": trading_strategy,
            "user_prompt": user_prompt,
            "symbol": selected_symbol,
            "snapshot": snapshot,
            "prompt": prompt,
            "raw_response": raw_response,
            "decision": decision.model_dump(),
            "execution": execution,
            "exit_feedback": exit_feedback,
            "compliance": {
                "passed": compliance.passed,
                "summary": compliance.summary,
                "events": compliance.events,
            },
            "run_id": run_id,
        }


engine = TradingEngine()
