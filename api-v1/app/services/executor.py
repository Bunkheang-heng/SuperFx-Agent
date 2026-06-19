from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.schemas.decision import TradeDecision
from app.services.mt5_connector import MT5Connector


def _resolve_mt5_pending_buy(entry_price: float, ask: float, point: float) -> tuple[str, float, str | None]:
    """Pick BUY_LIMIT vs BUY_STOP from price vs ask (MetaTrader rules)."""
    pt = max(float(point), 1e-12)
    p = float(entry_price)
    a = float(ask)
    if p < a:
        return "buy_limit", p, None
    if p > a:
        return "buy_stop", p, None
    p_adj = a + pt
    return (
        "buy_stop",
        p_adj,
        "entry_price equaled ask; nudged by one point for a valid buy stop",
    )


def _resolve_mt5_pending_sell(entry_price: float, bid: float, point: float) -> tuple[str, float, str | None]:
    """Pick SELL_LIMIT vs SELL_STOP from price vs bid (MetaTrader rules)."""
    pt = max(float(point), 1e-12)
    p = float(entry_price)
    b = float(bid)
    if p > b:
        return "sell_limit", p, None
    if p < b:
        return "sell_stop", p, None
    p_adj = b - pt
    return (
        "sell_stop",
        p_adj,
        "entry_price equaled bid; nudged by one point for a valid sell stop",
    )


def _effective_pending_order(
    declared_action: str,
    entry_price: float,
    bid: float,
    ask: float,
    point: float,
) -> tuple[str, float, str | None]:
    """
    Map model output to an MT5-valid pending type for the same direction.

    LIMIT vs STOP in MT5 is purely geometric (entry vs current bid/ask); models often
    mis-label SELL_LIMIT when they mean a sell below the market (SELL_STOP).
    """
    decl = declared_action.lower()
    if decl in {"buy_limit", "buy_stop"}:
        eff, price_eff, note = _resolve_mt5_pending_buy(entry_price, ask, point)
        if decl != eff:
            hint = f"model said {decl}; MT5 geometry requires {eff}"
            note = f"{hint}. {note}" if note else hint
        return eff, price_eff, note
    if decl in {"sell_limit", "sell_stop"}:
        eff, price_eff, note = _resolve_mt5_pending_sell(entry_price, bid, point)
        if decl != eff:
            hint = f"model said {decl}; MT5 geometry requires {eff}"
            note = f"{hint}. {note}" if note else hint
        return eff, price_eff, note
    raise ValueError(f"Not a pending action: {declared_action}")


class Executor:
    def __init__(self, connector: MT5Connector) -> None:
        self.connector = connector
        self.settings = get_settings()
        self._last_feedback_time_msc: int = 0

    def collect_exit_feedback(self, symbol: str) -> list[dict[str, Any]]:
        updates = self.connector.get_recent_exit_feedback(symbol, since_time_msc=self._last_feedback_time_msc)
        if updates:
            self._last_feedback_time_msc = int(max(item["time_msc"] for item in updates))
        return updates

    def _resolve_lot_size(self, decision: TradeDecision) -> float:
        if self.settings.use_model_lot_size:
            return decision.lot_size
        return self.settings.fixed_lot_size

    def execute(self, decision: TradeDecision, symbol: str) -> dict:
        if decision.action == "hold":
            return {
                "attempted": False,
                "executed": False,
                "is_pending": False,
                "status": "held",
                "decision_action": decision.action,
                "lot_size": 0.0,
                "order_result": None,
                "retcode": None,
                "reject_reason": None,
            }

        lot_size = self._resolve_lot_size(decision)
        eff_action: str | None = None
        eff_entry: float | None = None
        coercion_note: str | None = None
        if decision.action in {"buy", "sell"}:
            order_result = self.connector.send_market_order(
                symbol=symbol,
                side=decision.action,
                lot_size=lot_size,
                sl=decision.stop_loss,
                tp=decision.take_profit,
                deviation=self.settings.max_slippage_points,
            )
            is_pending = False
        else:
            if decision.entry_price is None:
                raise ValueError("Pending order requires entry_price.")
            tick = self.connector.get_tick(symbol)
            bid = float(tick["bid"])
            ask = float(tick["ask"])
            sym = self.connector.get_symbol_info(symbol)
            point = float(sym.get("point") or 0.00001)
            eff_action, eff_entry, coercion_note = _effective_pending_order(
                decision.action,
                decision.entry_price,
                bid=bid,
                ask=ask,
                point=point,
            )
            order_result = self.connector.send_pending_order(
                symbol=symbol,
                order_type=eff_action,
                lot_size=lot_size,
                entry_price=eff_entry,
                sl=decision.stop_loss,
                tp=decision.take_profit,
                time_in_force=decision.time_in_force,
                cancel_if_not_filled_minutes=decision.cancel_if_not_filled_minutes,
            )
            is_pending = True

        mt5_result = order_result.get("result", {})
        retcode = int(mt5_result.get("retcode", 0))
        accepted_retcodes = {10008, 10009, 10010}
        executed = retcode in accepted_retcodes
        out: dict[str, Any] = {
            "attempted": True,
            "executed": executed,
            "is_pending": is_pending,
            "status": ("placed" if is_pending else "sent") if executed else "rejected",
            "decision_action": decision.action,
            "lot_size": lot_size,
            "entry_price": decision.entry_price,
            "order_result": order_result,
            "retcode": retcode,
            "reject_reason": None if executed else mt5_result.get("comment"),
        }
        if is_pending and eff_action is not None and eff_entry is not None:
            out["effective_pending_action"] = eff_action
            out["effective_entry_price"] = eff_entry
            if coercion_note:
                out["pending_coercion_note"] = coercion_note
        return out

    ACCEPTED_RETCODES = {10008, 10009, 10010}

    def close_positions(self, symbol: str) -> dict[str, Any]:
        positions = self.connector.get_positions(symbol)
        if not positions:
            return {"attempted": False, "closed": 0, "status": "no_position", "results": []}

        results: list[dict[str, Any]] = []
        closed = 0
        for position in positions:
            try:
                outcome = self.connector.close_position(
                    symbol=symbol,
                    position=position,
                    deviation=self.settings.max_slippage_points,
                )
                retcode = int(outcome.get("retcode", 0))
                ok = retcode in self.ACCEPTED_RETCODES
                if ok:
                    closed += 1
                results.append(
                    {
                        "ticket": position.get("ticket"),
                        "ok": ok,
                        "retcode": retcode,
                        "comment": outcome.get("comment"),
                    }
                )
            except Exception as exc:
                results.append(
                    {
                        "ticket": position.get("ticket"),
                        "ok": False,
                        "error": str(exc),
                    }
                )
        return {
            "attempted": True,
            "closed": closed,
            "status": "closed" if closed else "failed",
            "results": results,
        }

    def modify_positions(
        self,
        symbol: str,
        new_sl: float | None,
        new_tp: float | None,
    ) -> dict[str, Any]:
        if new_sl is None and new_tp is None:
            return {"attempted": False, "modified": 0, "status": "noop", "results": []}

        positions = self.connector.get_positions(symbol)
        if not positions:
            return {"attempted": False, "modified": 0, "status": "no_position", "results": []}

        results: list[dict[str, Any]] = []
        modified = 0
        for position in positions:
            try:
                outcome = self.connector.modify_position(
                    symbol=symbol,
                    position=position,
                    sl=new_sl,
                    tp=new_tp,
                )
                mt5_result = outcome.get("result", {})
                retcode = int(mt5_result.get("retcode", 0))
                ok = retcode in self.ACCEPTED_RETCODES
                if ok:
                    modified += 1
                results.append(
                    {
                        "ticket": position.get("ticket"),
                        "ok": ok,
                        "retcode": retcode,
                        "new_sl": new_sl,
                        "new_tp": new_tp,
                        "comment": mt5_result.get("comment"),
                    }
                )
            except Exception as exc:
                results.append(
                    {
                        "ticket": position.get("ticket"),
                        "ok": False,
                        "error": str(exc),
                    }
                )
        return {
            "attempted": True,
            "modified": modified,
            "status": "modified" if modified else "failed",
            "results": results,
        }
