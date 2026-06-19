from __future__ import annotations

import json
from typing import Any, Callable

from app.db.session import session_scope
from app.prompts.prop_firm import format_user_context_block
from app.prompts.prop_firm_desk import (
    PROP_FIRM_ANALYST_SYSTEM,
    PROP_FIRM_RISK_MANAGER_SYSTEM,
    PROP_FIRM_STRATEGIST_SYSTEM,
    PROP_FIRM_TEAM_LEAD_EXTRA,
    compute_evaluation_metrics,
    format_prop_firm_progress_block,
)
from app.schemas.api_models import AgentConfig, DeskMode, TradingAccountMode, TradingMode, TradingStrategy
from app.services.prop_compliance import PropComplianceService
from app.services.trading_cycle import execute_decision_with_compliance, record_trading_run, resolve_prop_firm_for_account_mode
from app.schemas.prop_firm import PropFirmRules
from app.services.cycle_gate import CycleCancelledError
from app.services.engine import TradingEngine

EventHandler = Callable[[str, dict[str, Any]], None]


ANALYST_SYSTEM_PROMPT = (
    "You are the ANALYST agent in a 4-agent collaborative trading desk.\n"
    "Your job is to read the structured market snapshot and produce a clear, evidence-based read.\n"
    "Cover: dominant trend, momentum, volatility regime, key support/resistance levels, candle structure, "
    "open positions exposure, and notable risks.\n"
    "Be specific with numbers from the snapshot. Avoid vague language.\n"
    "Do NOT propose trades, do NOT output JSON. Output a tight markdown report (under ~400 words)."
)

STRATEGIST_SYSTEM_PROMPT = (
    "You are the STRATEGIST agent in a 4-agent collaborative trading desk.\n"
    "Use the analyst's report and the market snapshot to design 1 or 2 candidate trade setups.\n"
    "For each setup state: direction, order type (market/pending), entry zone, stop-loss, take-profit, "
    "approximate R-multiple, conditions to invalidate, and why it fits the analyst's read.\n"
    "Be honest about uncertainty. If conditions are bad, recommend NO TRADE and explain why.\n"
    "Do NOT output the final JSON; that is the team lead's job. Output concise markdown."
)

RISK_MANAGER_SYSTEM_PROMPT = (
    "You are the RISK MANAGER agent in a 4-agent collaborative trading desk.\n"
    "Review the analyst's report, the strategist's proposals, and the snapshot. Stress-test each setup.\n"
    "For every proposed setup, score the following on a 1-5 scale: location quality, R-multiple, "
    "alignment with regime, invalidation clarity, exposure vs current positions.\n"
    "Flag any red flags (poor R:R, chasing, missing stop, oversize, conflicting positions, illiquid hours).\n"
    "End your report with a clear recommendation: APPROVE, APPROVE WITH ADJUSTMENTS, or REJECT — and a "
    "suggested lot size cap relative to typical risk.\n"
    "Do NOT output the final JSON; that is the team lead's job. Output concise markdown."
)

MONITOR_ANALYST_SYSTEM_PROMPT = (
    "You are the ANALYST agent in a 4-agent collaborative trading desk, MONITORING an OPEN position.\n"
    "Read the live snapshot AND the open position context. State succinctly:\n"
    "- What price is doing right now relative to entry, SL, TP\n"
    "- Whether the original thesis still holds or has weakened\n"
    "- Any new structure: BOS, sweep, momentum shift, volume divergence, candle confirmation\n"
    "Be quick (under ~200 words). No JSON. Output a tight markdown blurb."
)

MONITOR_STRATEGIST_SYSTEM_PROMPT = (
    "You are the STRATEGIST agent MONITORING an OPEN position.\n"
    "Given the analyst's read and the live position, propose ONE management action:\n"
    "- LET IT RUN to TP, or\n"
    "- TRAIL the stop (new SL price), or\n"
    "- MOVE SL TO BREAK-EVEN (use the entry price as SL), or\n"
    "- PARTIAL/FULL CLOSE now (we only support FULL close), or\n"
    "- ADJUST TP (new TP price).\n"
    "Show R-multiple math when proposing a move. Don't output JSON. Be concise."
)

MONITOR_RISK_SYSTEM_PROMPT = (
    "You are the RISK MANAGER MONITORING an OPEN position.\n"
    "Stress-test the strategist's proposed management action. Cover:\n"
    "- Distance to current SL and TP in price + R\n"
    "- Time-in-trade vs typical hold\n"
    "- Drawdown vs initial risk\n"
    "- Whether moving SL closer (or to BE) is justified by structure or just emotion\n"
    "End with APPROVE / APPROVE WITH ADJUSTMENTS / REJECT and a one-line recommendation. No JSON."
)

MONITOR_TEAM_LEAD_SYSTEM_PROMPT_TMPL = (
    "You are the TEAM LEAD MONITORING an OPEN position. You have the FINAL SAY.\n"
    "Synthesize the analyst, strategist, and risk manager. Then output a management decision.\n"
    "Trading mode: {trading_mode}. Strategy framework: {trading_strategy}.\n\n"
    "You MUST end your message with a single line:\n"
    "MONITOR_DECISION_JSON\n"
    "and immediately after that, exactly one JSON object with these keys:\n"
    '{{"action": "hold|close|modify", "new_stop_loss": number|null, "new_take_profit": number|null, "reason": "short rationale"}}\n'
    "Rules:\n"
    "- 'hold' means do nothing this cycle. new_stop_loss/new_take_profit must be null.\n"
    "- 'close' means close the entire position at market now. new_stop_loss/new_take_profit must be null.\n"
    "- 'modify' means change SL and/or TP. At least ONE of new_stop_loss / new_take_profit MUST be set.\n"
    "- Prefer HOLD unless there is a clear reason to act. Only tighten SL when structure justifies it.\n"
    "- Output a brief reasoning paragraph BEFORE the MONITOR_DECISION_JSON line."
)


TEAM_LEAD_SYSTEM_PROMPT_TMPL = (
    "You are the TEAM LEAD agent in a 4-agent collaborative trading desk and you have the FINAL SAY.\n"
    "You receive: the analyst's market read, the strategist's proposed setups, and the risk manager's "
    "risk review. Synthesize them into ONE final decision.\n"
    "Weigh the risk manager's red flags strongly. Prefer HOLD when there is conflict, missing invalidation, "
    "poor R:R, or low confidence — except when trading_mode is aggressive (see below).\n"
    "Trading mode: {trading_mode}. Strategy framework: {trading_strategy}.\n\n"
    "You MUST end your message with a single line containing only:\n"
    "FINAL_DECISION_JSON\n"
    "Then on the following lines, output exactly ONE JSON object (no markdown heading, optional ```json "
    "fence allowed) containing ALL of these keys — omission is invalid:\n"
    "action, confidence, lot_size, entry_price, stop_loss, take_profit, time_in_force, "
    "cancel_if_not_filled_minutes, reason\n\n"
    "Types:\n"
    '- action: string — use uppercase tokens HOLD, BUY, SELL, BUY_LIMIT, SELL_LIMIT, BUY_STOP, SELL_STOP '
    "(lower-case is accepted but uppercase is clearer).\n"
    "- confidence: number from 0.0 through 1.0.\n"
    "- lot_size: number (use 0 only when action is HOLD).\n"
    "- entry_price, stop_loss, take_profit: number or JSON null.\n"
    '- time_in_force: string "gtc" or "day".\n'
    "- cancel_if_not_filled_minutes: integer or JSON null.\n"
    '- reason: non-empty string citing analyst / strategist / risk manager.\n\n'
    "Rules:\n"
    "- Market BUY or SELL: entry_price MUST be null; cancel_if_not_filled_minutes MUST be null.\n"
    "- Pending orders: entry_price is REQUIRED (number).\n"
    "- HOLD: lot_size = 0; entry_price, stop_loss, take_profit, cancel_if_not_filled_minutes = null.\n"
    "- If trading_mode is aggressive: action MUST be BUY or SELL only (mandatory market entry); NEVER HOLD "
    "or pending types; entry_price null; stop_loss and take_profit MUST be numbers (not null); "
    "lot_size > 0; pick the stronger directional bias from the desk even when signals are mixed.\n\n"
    "Valid minimal examples (replace numbers with ones justified by the snapshot):\n"
    'HOLD: {{"action":"HOLD","confidence":0.35,"lot_size":0,"entry_price":null,"stop_loss":null,'
    '"take_profit":null,"time_in_force":"gtc","cancel_if_not_filled_minutes":null,'
    '"reason":"Risk flags outweigh edge; flat."}}\n'
    'Aggressive market buy: {{"action":"BUY","confidence":0.62,"lot_size":0.05,"entry_price":null,'
    '"stop_loss":1.052,"take_profit":1.068,"time_in_force":"gtc","cancel_if_not_filled_minutes":null,'
    '"reason":"Strategist long aligns with analyst bias; risk sized small."}}\n'
    "- Output a brief reasoning paragraph BEFORE the FINAL_DECISION_JSON line."
)


def _float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _json_default(value: Any) -> Any:
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return str(value)


def _compact_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    candles = snapshot.get("candles") or []
    return {
        "symbol": snapshot.get("symbol"),
        "timeframe": snapshot.get("timeframe"),
        "timestamp": snapshot.get("timestamp"),
        "tick": snapshot.get("tick"),
        "indicators": snapshot.get("indicators"),
        "market_context": snapshot.get("market_context"),
        "account": snapshot.get("account"),
        "positions": snapshot.get("positions"),
        "recent_candles": list(candles)[-25:] if candles else [],
        "candle_count": len(candles) if candles else 0,
    }


def _agent_label(agent: AgentConfig) -> str:
    fallback = agent.role.replace("_", " ").title()
    return (agent.name or fallback).strip() or fallback


def _abort_if_stopped(
    stop_flag: Callable[[], bool] | None,
    event_handler: EventHandler | None = None,
) -> None:
    if stop_flag is not None and stop_flag():
        if event_handler is not None:
            event_handler("cancelled", {"message": "Cycle stopped"})
        raise CycleCancelledError("Cycle stopped")


def _sleep_interruptible(total_seconds: int, stop_flag: Callable[[], bool] | None) -> None:
    import time

    if total_seconds <= 0:
        return
    remaining = int(total_seconds)
    while remaining > 0:
        if stop_flag is not None and stop_flag():
            return
        step = 1 if remaining > 1 else remaining
        time.sleep(step)
        remaining -= step


def _merge_system_prompt_with_skills(base: str, agent: AgentConfig) -> str:
    extra = (agent.skills or "").strip()
    if not extra:
        return base
    return (
        base.rstrip()
        + "\n\n---\nAgent skills (apply consistently; do not contradict the role instructions above):\n"
        + extra
    )


class MultiAgentOrchestrator:
    REQUIRED_ROLES = ("analyst", "strategist", "risk_manager", "team_lead")

    def __init__(self, engine: TradingEngine) -> None:
        self.engine = engine

    def _resolve_agents(self, agents: list[AgentConfig]) -> dict[str, AgentConfig]:
        if len(agents) != 4:
            raise ValueError("Multi-agent run requires exactly 4 agents.")
        by_role: dict[str, AgentConfig] = {}
        for agent in agents:
            if agent.role in by_role:
                raise ValueError(f"Duplicate agent role: {agent.role}")
            by_role[agent.role] = agent
        missing = [role for role in self.REQUIRED_ROLES if role not in by_role]
        if missing:
            raise ValueError(
                "Missing agent roles: " + ", ".join(missing)
                + ". Required: analyst, strategist, risk_manager, team_lead."
            )
        return by_role

    def _system_prompt_for(
        self,
        agent: AgentConfig,
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        mode: str = "entry",
        desk_mode: DeskMode = "standard",
        account_mode: TradingAccountMode = "real",
    ) -> str:
        custom = (agent.system_prompt or "").strip()
        if custom:
            base = custom
        elif mode == "monitor":
            if agent.role == "analyst":
                base = MONITOR_ANALYST_SYSTEM_PROMPT
            elif agent.role == "strategist":
                base = MONITOR_STRATEGIST_SYSTEM_PROMPT
            elif agent.role == "risk_manager":
                base = MONITOR_RISK_SYSTEM_PROMPT
            else:
                base = MONITOR_TEAM_LEAD_SYSTEM_PROMPT_TMPL.format(
                    trading_mode=trading_mode,
                    trading_strategy=trading_strategy,
                )
        elif account_mode == "prop_firm":
            if agent.role == "analyst":
                base = PROP_FIRM_ANALYST_SYSTEM
            elif agent.role == "strategist":
                base = PROP_FIRM_STRATEGIST_SYSTEM
            elif agent.role == "risk_manager":
                base = PROP_FIRM_RISK_MANAGER_SYSTEM
            else:
                base = TEAM_LEAD_SYSTEM_PROMPT_TMPL.format(
                    trading_mode=trading_mode,
                    trading_strategy=trading_strategy,
                ) + PROP_FIRM_TEAM_LEAD_EXTRA
        elif agent.role == "analyst":
            base = ANALYST_SYSTEM_PROMPT
        elif agent.role == "strategist":
            base = STRATEGIST_SYSTEM_PROMPT
        elif agent.role == "risk_manager":
            base = RISK_MANAGER_SYSTEM_PROMPT
        else:
            base = TEAM_LEAD_SYSTEM_PROMPT_TMPL.format(
                trading_mode=trading_mode,
                trading_strategy=trading_strategy,
            )
        return _merge_system_prompt_with_skills(base, agent)

    def _build_progress_block(
        self,
        *,
        account_mode: TradingAccountMode,
        prop_firm_rules: PropFirmRules | None,
        account_info: dict[str, Any],
    ) -> str:
        if account_mode != "prop_firm" or prop_firm_rules is None or not prop_firm_rules.enabled:
            return ""
        balance = account_info.get("balance")
        equity = account_info.get("equity")
        login = str(account_info.get("login") or "default")
        server = str(account_info.get("server") or "mt5")
        account_key = f"{server}:{login}"
        try:
            with session_scope() as db:
                compliance = PropComplianceService(db)
                compliance._update_day_state(account_key, _float(balance), _float(equity))
                day_state = compliance._get_day_state(account_key)
                baseline = day_state.baseline_balance if day_state else _float(balance)
                peak = day_state.peak_equity if day_state else _float(equity)
                metrics = compute_evaluation_metrics(
                    rules=prop_firm_rules,
                    balance=_float(balance),
                    equity=_float(equity),
                    baseline_balance=baseline,
                    peak_equity=peak,
                )
                return format_prop_firm_progress_block(metrics)
        except Exception:
            metrics = compute_evaluation_metrics(
                rules=prop_firm_rules,
                balance=_float(balance),
                equity=_float(equity),
                baseline_balance=_float(balance),
                peak_equity=_float(equity),
            )
            return format_prop_firm_progress_block(metrics)

    def _context_block(
        self,
        user_prompt: str | None,
        prop_firm_rules: PropFirmRules | None,
        progress_block: str,
    ) -> str:
        return format_user_context_block(
            user_prompt,
            prop_firm_rules,
            progress_block=progress_block or None,
        )

    def _build_analyst_prompt(
        self,
        snapshot: dict[str, Any],
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        user_prompt: str | None,
        prop_firm_rules: PropFirmRules | None = None,
        progress_block: str = "",
    ) -> str:
        compact = _compact_snapshot(snapshot)
        snapshot_json = json.dumps(compact, separators=(",", ":"), default=_json_default)
        context = self._context_block(user_prompt, prop_firm_rules, progress_block)
        extra_block = f"\n\n{context}" if context else ""
        return (
            f"Trading mode: {trading_mode}. Strategy framework: {trading_strategy}.\n"
            f"Symbol: {compact.get('symbol')} | Timeframe: {compact.get('timeframe')}\n\n"
            "Read the following structured market snapshot and produce your analyst report.\n\n"
            "Snapshot JSON:\n"
            f"{snapshot_json}"
            f"{extra_block}"
        )

    def _build_strategist_prompt(
        self,
        snapshot: dict[str, Any],
        analyst_output: str,
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        user_prompt: str | None,
        prop_firm_rules: PropFirmRules | None = None,
        progress_block: str = "",
    ) -> str:
        compact = _compact_snapshot(snapshot)
        snapshot_json = json.dumps(compact, separators=(",", ":"), default=_json_default)
        context = self._context_block(user_prompt, prop_firm_rules, progress_block)
        extra_block = f"\n\n{context}" if context else ""
        return (
            f"Trading mode: {trading_mode}. Strategy framework: {trading_strategy}.\n"
            f"Symbol: {compact.get('symbol')} | Timeframe: {compact.get('timeframe')}\n\n"
            "ANALYST REPORT:\n"
            f"{analyst_output.strip()}\n\n"
            "Snapshot JSON:\n"
            f"{snapshot_json}\n\n"
            "Now propose 1 or 2 candidate trade setups (or recommend NO TRADE)."
            f"{extra_block}"
        )

    def _build_risk_manager_prompt(
        self,
        snapshot: dict[str, Any],
        analyst_output: str,
        strategist_output: str,
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        user_prompt: str | None,
        prop_firm_rules: PropFirmRules | None = None,
        progress_block: str = "",
    ) -> str:
        compact = _compact_snapshot(snapshot)
        snapshot_json = json.dumps(compact, separators=(",", ":"), default=_json_default)
        context = self._context_block(user_prompt, prop_firm_rules, progress_block)
        extra_block = f"\n\n{context}" if context else ""
        return (
            f"Trading mode: {trading_mode}. Strategy framework: {trading_strategy}.\n"
            f"Symbol: {compact.get('symbol')} | Timeframe: {compact.get('timeframe')}\n\n"
            "ANALYST REPORT:\n"
            f"{analyst_output.strip()}\n\n"
            "STRATEGIST PROPOSAL:\n"
            f"{strategist_output.strip()}\n\n"
            "Snapshot JSON:\n"
            f"{snapshot_json}\n\n"
            "Now produce your risk review. End with APPROVE / APPROVE WITH ADJUSTMENTS / REJECT and a "
            "suggested lot size cap. Do NOT output the trade JSON; the team lead will do that."
            f"{extra_block}"
        )

    def _build_team_lead_prompt(
        self,
        snapshot: dict[str, Any],
        analyst_output: str,
        strategist_output: str,
        risk_output: str,
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        user_prompt: str | None,
        prop_firm_rules: PropFirmRules | None = None,
        progress_block: str = "",
    ) -> str:
        compact = _compact_snapshot(snapshot)
        snapshot_json = json.dumps(compact, separators=(",", ":"), default=_json_default)
        context = self._context_block(user_prompt, prop_firm_rules, progress_block)
        extra_block = f"\n\n{context}" if context else ""
        aggressive_block = ""
        if trading_mode == "aggressive":
            aggressive_block = (
                "\n\nCRITICAL (aggressive mode): After FINAL_DECISION_JSON your JSON must include every "
                "required key. action must be BUY or SELL only (market order). entry_price must be null. "
                "stop_loss and take_profit must be numeric (not null). cancel_if_not_filled_minutes must "
                "be null. lot_size must be greater than zero.\n"
            )
        return (
            f"Trading mode: {trading_mode}. Strategy framework: {trading_strategy}.\n"
            f"Symbol: {compact.get('symbol')} | Timeframe: {compact.get('timeframe')}\n\n"
            "ANALYST REPORT:\n"
            f"{analyst_output.strip()}\n\n"
            "STRATEGIST PROPOSAL:\n"
            f"{strategist_output.strip()}\n\n"
            "RISK MANAGER REVIEW:\n"
            f"{risk_output.strip()}\n\n"
            "Snapshot JSON:\n"
            f"{snapshot_json}\n\n"
            "You are the team lead. Make the final call. End with the exact line FINAL_DECISION_JSON then "
            "one JSON object listing keys: action, confidence, lot_size, entry_price, stop_loss, "
            "take_profit, time_in_force, cancel_if_not_filled_minutes, reason."
            f"{aggressive_block}"
            f"{extra_block}"
        )

    def _run_agent(
        self,
        agent: AgentConfig,
        prompt: str,
        system_prompt: str,
        event_handler: EventHandler | None,
        stop_flag: Callable[[], bool] | None = None,
    ) -> str:
        _abort_if_stopped(stop_flag, event_handler)
        if event_handler is not None:
            event_handler(
                "agent_start",
                {
                    "role": agent.role,
                    "name": _agent_label(agent),
                    "provider": agent.provider,
                    "model": agent.model,
                },
            )

        def _on_token(token: str) -> None:
            if stop_flag is not None and stop_flag():
                raise CycleCancelledError("Cycle stopped")
            if event_handler is not None and isinstance(token, str) and token:
                event_handler("agent_token", {"role": agent.role, "token": token})

        temperature = agent.temperature if agent.temperature is not None else 0.1
        text = self.engine.llm.complete_with_credentials(
            provider=agent.provider,
            api_key=agent.api_key,
            model=agent.model,
            prompt=prompt,
            system_prompt=system_prompt,
            base_url=agent.base_url,
            stream_handler=_on_token if event_handler is not None else None,
            temperature=temperature,
        )

        if event_handler is not None:
            event_handler(
                "agent_done",
                {
                    "role": agent.role,
                    "name": _agent_label(agent),
                    "provider": agent.provider,
                    "model": agent.model,
                    "output": text,
                },
            )
        return text

    def run(
        self,
        agents: list[AgentConfig],
        symbol: str,
        wait_for_new_candle: bool,
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        user_prompt: str | None = None,
        prop_firm_rules: PropFirmRules | None = None,
        prop_firm_profile_id: int | None = None,
        desk_mode: DeskMode = "standard",
        account_mode: TradingAccountMode = "real",
        execute: bool = True,
        event_handler: EventHandler | None = None,
        stop_flag: Callable[[], bool] | None = None,
    ) -> dict[str, Any]:
        engine = self.engine
        engine.ensure_connected()

        with session_scope() as db:
            resolved_rules, resolved_profile_id = resolve_prop_firm_for_account_mode(
                db,
                account_mode=account_mode,
                inline_rules=prop_firm_rules,
                profile_id=prop_firm_profile_id,
            )
        prop_firm_rules = resolved_rules
        prop_firm_profile_id = resolved_profile_id

        if desk_mode == "prop_firm" and account_mode == "prop_firm":
            if prop_firm_rules is None or not prop_firm_rules.enabled:
                raise ValueError(
                    "Prop firm desk requires enabled prop firm rules. Save a profile on the Prop Firm page."
                )
            if prop_firm_rules.profit_target_pct is None:
                raise ValueError(
                    "Prop firm desk requires a profit target % (evaluation goal). Set it in prop firm rules."
                )

        roles = self._resolve_agents(agents)

        analyst_cfg = roles["analyst"]
        strategist_cfg = roles["strategist"]
        risk_cfg = roles["risk_manager"]
        team_lead_cfg = roles["team_lead"]

        selected_symbol = symbol.strip()
        timeframe = engine.settings.trade_timeframe

        if event_handler is not None:
            event_handler("status", {"message": f"Preparing snapshot for {selected_symbol} ({timeframe})"})

        if wait_for_new_candle:
            if event_handler is not None:
                event_handler("status", {"message": "Waiting for new closed candle"})
            engine.scheduler.wait_for_new_closed_candle(
                key=(selected_symbol, timeframe),
                get_last_closed_candle_time=lambda: engine.mt5.get_last_closed_candle_time(
                    selected_symbol, timeframe
                ),
                stop_flag=stop_flag,
            )

        _abort_if_stopped(stop_flag, event_handler)

        candles = engine.mt5.get_candles(selected_symbol, timeframe, engine.settings.candle_count)
        tick = engine.mt5.get_tick(selected_symbol)
        positions = engine.mt5.get_positions(selected_symbol)
        account_info = engine.mt5.get_account_info()
        snapshot = engine.snapshot_service.capture(
            symbol=selected_symbol,
            timeframe=timeframe,
            candles=candles,
            tick=tick,
            account_info=account_info,
            positions=positions,
        )
        engine.logger.log_snapshot(snapshot)

        progress_block = self._build_progress_block(
            account_mode=account_mode,
            prop_firm_rules=prop_firm_rules,
            account_info=account_info,
        )
        evaluation_progress: dict[str, Any] | None = None
        if account_mode == "prop_firm" and prop_firm_rules:
            evaluation_progress = compute_evaluation_metrics(
                rules=prop_firm_rules,
                balance=_float(account_info.get("balance")),
                equity=_float(account_info.get("equity")),
                baseline_balance=_float(account_info.get("balance")),
                peak_equity=_float(account_info.get("equity")),
            )

        run_type_label = "prop_firm_desk" if desk_mode == "prop_firm" else "multi_agent"
        agent_outputs: list[dict[str, Any]] = []

        analyst_prompt = self._build_analyst_prompt(
            snapshot, trading_mode, trading_strategy, user_prompt, prop_firm_rules, progress_block
        )
        analyst_system = self._system_prompt_for(
            analyst_cfg, trading_mode, trading_strategy, desk_mode=desk_mode, account_mode=account_mode
        )
        if event_handler is not None:
            event_handler("status", {"message": "Analyst running"})
        _abort_if_stopped(stop_flag, event_handler)
        analyst_output = self._run_agent(
            analyst_cfg, analyst_prompt, analyst_system, event_handler, stop_flag
        )
        agent_outputs.append(
            {
                "role": "analyst",
                "name": _agent_label(analyst_cfg),
                "provider": analyst_cfg.provider,
                "model": analyst_cfg.model,
                "prompt": analyst_prompt,
                "output": analyst_output,
                "error": None,
            }
        )

        strategist_prompt = self._build_strategist_prompt(
            snapshot,
            analyst_output,
            trading_mode,
            trading_strategy,
            user_prompt,
            prop_firm_rules,
            progress_block,
        )
        strategist_system = self._system_prompt_for(
            strategist_cfg, trading_mode, trading_strategy, desk_mode=desk_mode, account_mode=account_mode
        )
        if event_handler is not None:
            event_handler("status", {"message": "Strategist running"})
        _abort_if_stopped(stop_flag, event_handler)
        strategist_output = self._run_agent(
            strategist_cfg, strategist_prompt, strategist_system, event_handler, stop_flag
        )
        agent_outputs.append(
            {
                "role": "strategist",
                "name": _agent_label(strategist_cfg),
                "provider": strategist_cfg.provider,
                "model": strategist_cfg.model,
                "prompt": strategist_prompt,
                "output": strategist_output,
                "error": None,
            }
        )

        risk_prompt = self._build_risk_manager_prompt(
            snapshot,
            analyst_output,
            strategist_output,
            trading_mode,
            trading_strategy,
            user_prompt,
            prop_firm_rules,
            progress_block,
        )
        risk_system = self._system_prompt_for(
            risk_cfg, trading_mode, trading_strategy, desk_mode=desk_mode, account_mode=account_mode
        )
        if event_handler is not None:
            event_handler("status", {"message": "Risk manager reviewing setups"})
        _abort_if_stopped(stop_flag, event_handler)
        risk_output = self._run_agent(risk_cfg, risk_prompt, risk_system, event_handler, stop_flag)
        agent_outputs.append(
            {
                "role": "risk_manager",
                "name": _agent_label(risk_cfg),
                "provider": risk_cfg.provider,
                "model": risk_cfg.model,
                "prompt": risk_prompt,
                "output": risk_output,
                "error": None,
            }
        )

        team_lead_prompt = self._build_team_lead_prompt(
            snapshot,
            analyst_output,
            strategist_output,
            risk_output,
            trading_mode,
            trading_strategy,
            user_prompt,
            prop_firm_rules,
            progress_block,
        )
        team_lead_system = self._system_prompt_for(
            team_lead_cfg, trading_mode, trading_strategy, desk_mode=desk_mode, account_mode=account_mode
        )
        if event_handler is not None:
            event_handler("status", {"message": "Team lead making final decision"})
        _abort_if_stopped(stop_flag, event_handler)
        team_lead_output = self._run_agent(
            team_lead_cfg, team_lead_prompt, team_lead_system, event_handler, stop_flag
        )
        agent_outputs.append(
            {
                "role": "team_lead",
                "name": _agent_label(team_lead_cfg),
                "provider": team_lead_cfg.provider,
                "model": team_lead_cfg.model,
                "prompt": team_lead_prompt,
                "output": team_lead_output,
                "error": None,
            }
        )

        try:
            json_text = engine.llm._extract_json_object(team_lead_output)
            decision_payload = json.loads(json_text)
            decision = engine.llm._validate_decision_payload(
                decision_payload,
                symbol=selected_symbol,
                trading_mode=trading_mode,
            )
        except Exception as exc:
            raise ValueError(
                "Team lead did not return a valid FINAL_DECISION_JSON object: " + str(exc)
            ) from exc

        engine.logger.log_decision(
            {
                "multi_agent": True,
                "trading_mode": trading_mode,
                "trading_strategy": trading_strategy,
                "user_prompt": user_prompt,
                "symbol": selected_symbol,
                "agents": [
                    {
                        "role": item["role"],
                        "name": item["name"],
                        "provider": item["provider"],
                        "model": item["model"],
                    }
                    for item in agent_outputs
                ],
                "raw_response": risk_output,
                "parsed_decision": decision.model_dump(),
            }
        )

        execution: dict[str, Any] = {}
        exit_feedback: dict[str, Any] | None = None
        executed = False
        compliance_summary: dict[str, Any] | None = None
        run_id: int | None = None
        if execute:
            if event_handler is not None:
                event_handler("status", {"message": "Checking prop firm compliance"})
            execution, executed, compliance, resolved_profile_id = execute_decision_with_compliance(
                engine,
                decision=decision,
                symbol=selected_symbol,
                snapshot=snapshot,
                account_info=account_info,
                open_position_count=len(positions),
                prop_firm_rules=prop_firm_rules,
                prop_firm_profile_id=prop_firm_profile_id,
                should_execute=True,
                account_mode=account_mode,
            )
            compliance_summary = {
                "passed": compliance.passed,
                "summary": compliance.summary,
                "events": compliance.events,
            }
            if event_handler is not None:
                if execution.get("prop_firm_blocked"):
                    event_handler("status", {"message": f"Trade blocked: {compliance.summary}"})
                else:
                    event_handler("status", {"message": "Executing trade decision"})
            exit_feedback = engine.executor.collect_exit_feedback(selected_symbol)
            run_id = record_trading_run(
                engine,
                run_type=run_type_label,
                symbol=selected_symbol,
                trading_mode=trading_mode,
                trading_strategy=trading_strategy,
                snapshot=snapshot,
                decision=decision,
                execution=execution,
                executed=executed,
                compliance=compliance,
                prop_firm_profile_id=resolved_profile_id,
                user_prompt=user_prompt,
                agent_outputs=agent_outputs,
            )
            engine.logger.log_order(
                {
                    "multi_agent": True,
                    "trading_mode": trading_mode,
                    "trading_strategy": trading_strategy,
                    "symbol": selected_symbol,
                    "decision": decision.model_dump(),
                    "execution": execution,
                    "exit_feedback": exit_feedback,
                    "compliance": compliance.summary,
                    "run_id": run_id,
                }
            )
        else:
            from app.services.prop_compliance import ComplianceCheckResult

            compliance = ComplianceCheckResult(passed=True, summary="Execute disabled")
            run_id = record_trading_run(
                engine,
                run_type=run_type_label,
                symbol=selected_symbol,
                trading_mode=trading_mode,
                trading_strategy=trading_strategy,
                snapshot=snapshot,
                decision=decision,
                execution={},
                executed=False,
                compliance=compliance,
                prop_firm_profile_id=prop_firm_profile_id,
                user_prompt=user_prompt,
                agent_outputs=agent_outputs,
            )

        result = {
            "symbol": selected_symbol,
            "trading_mode": trading_mode,
            "trading_strategy": trading_strategy,
            "snapshot": snapshot,
            "agents": agent_outputs,
            "decision": decision.model_dump(),
            "execution": execution,
            "exit_feedback": exit_feedback,
            "executed": executed,
            "compliance": compliance_summary,
            "evaluation_progress": evaluation_progress,
            "desk_mode": desk_mode,
            "run_id": run_id,
        }

        if event_handler is not None:
            event_handler("done", result)

        return result

    def run_auto_trade_loop(
        self,
        agents: list[AgentConfig],
        symbol: str,
        wait_for_new_candle: bool,
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        user_prompt: str | None,
        execute: bool,
        entry_interval_seconds: int,
        monitor_interval_seconds: int,
        monitor_max_iterations: int,
        event_handler: EventHandler | None,
        stop_flag: Callable[[], bool] | None = None,
        prop_firm_rules: PropFirmRules | None = None,
        prop_firm_profile_id: int | None = None,
        desk_mode: DeskMode = "standard",
        account_mode: TradingAccountMode = "real",
    ) -> dict[str, Any]:
        self._resolve_agents(agents)
        symbol_s = symbol.strip()
        summary: dict[str, Any] = {"entry_cycles": 0, "recoverable_errors": 0, "last_round": 0}

        with session_scope() as db:
            prop_firm_rules, prop_firm_profile_id = resolve_prop_firm_for_account_mode(
                db,
                account_mode=account_mode,
                inline_rules=prop_firm_rules,
                profile_id=prop_firm_profile_id,
            )

        if event_handler is not None:
            event_handler(
                "auto_trade_started",
                {
                    "symbol": symbol_s,
                    "entry_interval_seconds": entry_interval_seconds,
                    "monitor_interval_seconds": monitor_interval_seconds,
                    "monitor_max_iterations": monitor_max_iterations,
                    "execute": execute,
                },
            )

        round_no = 0
        while True:
            if stop_flag is not None and stop_flag():
                break

            round_no += 1
            summary["last_round"] = round_no
            if event_handler is not None:
                event_handler("auto_trade_round", {"round": round_no, "phase": "entry"})

            try:
                self.run(
                    agents=agents,
                    symbol=symbol_s,
                    wait_for_new_candle=wait_for_new_candle,
                    trading_mode=trading_mode,
                    trading_strategy=trading_strategy,
                    user_prompt=user_prompt,
                    prop_firm_rules=prop_firm_rules,
                    prop_firm_profile_id=prop_firm_profile_id,
                    desk_mode=desk_mode,
                    account_mode=account_mode,
                    execute=execute,
                    event_handler=event_handler,
                    stop_flag=stop_flag,
                )
                summary["entry_cycles"] += 1
            except CycleCancelledError:
                break
            except Exception as exc:
                self.engine.logger.log_exception("auto-trade-entry-cycle-failed", exc)
                summary["recoverable_errors"] += 1
                if event_handler is not None:
                    event_handler(
                        "error",
                        {"error": str(exc), "round": round_no, "recoverable": True},
                    )
                if stop_flag is not None and stop_flag():
                    break
                _sleep_interruptible(entry_interval_seconds, stop_flag)
                continue

            if stop_flag is not None and stop_flag():
                break

            tick = self.engine.mt5.get_tick(symbol_s)
            positions = self.engine.mt5.get_positions(symbol_s)
            position = self._position_summary(positions, tick)

            if position.get("open") and execute:
                if event_handler is not None:
                    event_handler("auto_trade_round", {"round": round_no, "phase": "monitor"})
                    event_handler(
                        "position_update",
                        {"iteration": 1, "position": position},
                    )
                self.run_monitor_loop(
                    agents=agents,
                    symbol=symbol_s,
                    trading_mode=trading_mode,
                    trading_strategy=trading_strategy,
                    user_prompt=user_prompt,
                    prop_firm_rules=prop_firm_rules,
                    prop_firm_profile_id=prop_firm_profile_id,
                    account_mode=account_mode,
                    interval_seconds=monitor_interval_seconds,
                    max_iterations=monitor_max_iterations,
                    execute=execute,
                    event_handler=event_handler,
                    stop_flag=stop_flag,
                )

            if stop_flag is not None and stop_flag():
                break

            if event_handler is not None:
                event_handler("auto_trade_round", {"round": round_no, "phase": "cooldown"})
            _sleep_interruptible(entry_interval_seconds, stop_flag)

        if stop_flag is not None and stop_flag():
            if event_handler is not None:
                event_handler("cancelled", {"message": "Auto-trading stopped"})
            return summary

        if event_handler is not None:
            event_handler("auto_trade_done", summary)
        return summary

    def _position_summary(self, positions: list[dict[str, Any]], tick: dict[str, Any]) -> dict[str, Any]:
        if not positions:
            return {"open": False}
        total_volume = sum(float(p.get("volume") or 0.0) for p in positions)
        total_profit = sum(float(p.get("profit") or 0.0) for p in positions)
        first = positions[0]
        side = "buy" if int(first.get("type", 0)) == 0 else "sell"
        bid = float(tick.get("bid") or 0.0)
        ask = float(tick.get("ask") or 0.0)
        current_price = bid if side == "buy" else ask
        entry_price = float(first.get("price_open") or 0.0)
        sl = float(first.get("sl") or 0.0) or None
        tp = float(first.get("tp") or 0.0) or None
        return {
            "open": True,
            "tickets": [p.get("ticket") for p in positions],
            "side": side,
            "volume": total_volume,
            "entry_price": entry_price,
            "current_price": current_price,
            "stop_loss": sl,
            "take_profit": tp,
            "profit": total_profit,
            "position_count": len(positions),
            "raw_positions": positions,
        }

    def _build_monitor_agent_prompt(
        self,
        snapshot: dict[str, Any],
        position: dict[str, Any],
        previous_outputs: dict[str, str],
        role: str,
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        user_prompt: str | None,
        prop_firm_rules: PropFirmRules | None,
        iteration: int,
    ) -> str:
        compact = _compact_snapshot(snapshot)
        snapshot_json = json.dumps(compact, separators=(",", ":"), default=_json_default)
        position_json = json.dumps(position, separators=(",", ":"), default=_json_default)
        context = format_user_context_block(user_prompt, prop_firm_rules)
        extra_block = f"\n\n{context}" if context else ""

        prior_blocks: list[str] = []
        if "analyst" in previous_outputs and role != "analyst":
            prior_blocks.append("ANALYST READ:\n" + previous_outputs["analyst"].strip())
        if "strategist" in previous_outputs and role in {"risk_manager", "team_lead"}:
            prior_blocks.append("STRATEGIST PROPOSAL:\n" + previous_outputs["strategist"].strip())
        if "risk_manager" in previous_outputs and role == "team_lead":
            prior_blocks.append("RISK MANAGER REVIEW:\n" + previous_outputs["risk_manager"].strip())
        prior_block_text = "\n\n".join(prior_blocks)
        if prior_block_text:
            prior_block_text = prior_block_text + "\n\n"

        instruction_by_role = {
            "analyst": "Now write your monitoring read.",
            "strategist": "Now propose ONE management action with R math.",
            "risk_manager": "Now review the strategist's action. End with APPROVE / APPROVE WITH ADJUSTMENTS / REJECT.",
            "team_lead": (
                "Make the final monitoring call. End with the MONITOR_DECISION_JSON line and the JSON object."
            ),
        }

        return (
            f"Monitoring iteration #{iteration}. Trading mode: {trading_mode}. "
            f"Strategy framework: {trading_strategy}.\n"
            f"Symbol: {compact.get('symbol')} | Timeframe: {compact.get('timeframe')}\n\n"
            "OPEN POSITION:\n"
            f"{position_json}\n\n"
            f"{prior_block_text}"
            "Snapshot JSON:\n"
            f"{snapshot_json}\n\n"
            f"{instruction_by_role.get(role, '')}"
            f"{extra_block}"
        )

    def monitor_once(
        self,
        agents_by_role: dict[str, AgentConfig],
        symbol: str,
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        user_prompt: str | None,
        iteration: int,
        execute: bool,
        event_handler: EventHandler | None,
        prop_firm_rules: PropFirmRules | None = None,
    ) -> dict[str, Any]:
        engine = self.engine
        engine.ensure_connected()
        timeframe = engine.settings.trade_timeframe

        if event_handler is not None:
            event_handler(
                "status",
                {"message": f"Monitor cycle #{iteration} preparing snapshot for {symbol}"},
            )

        positions = engine.mt5.get_positions(symbol)
        if not positions:
            if event_handler is not None:
                event_handler(
                    "position_closed",
                    {"symbol": symbol, "iteration": iteration, "reason": "no_position"},
                )
            return {"position_open": False, "iteration": iteration}

        candles = engine.mt5.get_candles(symbol, timeframe, engine.settings.candle_count)
        tick = engine.mt5.get_tick(symbol)
        account_info = engine.mt5.get_account_info()
        snapshot = engine.snapshot_service.capture(
            symbol=symbol,
            timeframe=timeframe,
            candles=candles,
            tick=tick,
            account_info=account_info,
            positions=positions,
        )
        position = self._position_summary(positions, tick)

        if event_handler is not None:
            event_handler("position_update", {"iteration": iteration, "position": position})

        outputs: dict[str, str] = {}
        agent_outputs: list[dict[str, Any]] = []
        for role in self.REQUIRED_ROLES:
            agent = agents_by_role[role]
            prompt = self._build_monitor_agent_prompt(
                snapshot=snapshot,
                position=position,
                previous_outputs=outputs,
                role=role,
                trading_mode=trading_mode,
                trading_strategy=trading_strategy,
                user_prompt=user_prompt,
                prop_firm_rules=prop_firm_rules,
                iteration=iteration,
            )
            system_prompt = self._system_prompt_for(
                agent, trading_mode, trading_strategy, mode="monitor"
            )
            if event_handler is not None:
                event_handler("status", {"message": f"{role.replace('_', ' ').title()} reviewing position"})
            output_text = self._run_agent(agent, prompt, system_prompt, event_handler)
            outputs[role] = output_text
            agent_outputs.append(
                {
                    "role": role,
                    "name": _agent_label(agent),
                    "provider": agent.provider,
                    "model": agent.model,
                    "prompt": prompt,
                    "output": output_text,
                    "error": None,
                }
            )

        team_lead_text = outputs["team_lead"]
        try:
            json_text = engine.llm._extract_json_object(
                team_lead_text, marker="MONITOR_DECISION_JSON"
            )
            decision_payload = json.loads(json_text)
        except Exception as exc:
            raise ValueError(
                "Team lead did not return a valid MONITOR_DECISION_JSON object: " + str(exc)
            ) from exc

        action = str(decision_payload.get("action", "hold")).strip().lower()
        if action not in {"hold", "close", "modify"}:
            action = "hold"
        new_sl = decision_payload.get("new_stop_loss")
        new_tp = decision_payload.get("new_take_profit")
        try:
            new_sl_f = float(new_sl) if new_sl is not None else None
        except (TypeError, ValueError):
            new_sl_f = None
        try:
            new_tp_f = float(new_tp) if new_tp is not None else None
        except (TypeError, ValueError):
            new_tp_f = None
        reason = str(decision_payload.get("reason", "")).strip()[:2000]

        if action == "modify" and new_sl_f is None and new_tp_f is None:
            action = "hold"
            reason = (reason + " [forced HOLD: modify requires new SL or TP]").strip()

        decision_record = {
            "action": action,
            "new_stop_loss": new_sl_f,
            "new_take_profit": new_tp_f,
            "reason": reason,
        }

        execution: dict[str, Any] = {"attempted": False}
        if execute:
            if action == "close":
                if event_handler is not None:
                    event_handler("status", {"message": "Team lead: CLOSING position"})
                execution = engine.executor.close_positions(symbol)
            elif action == "modify":
                if event_handler is not None:
                    event_handler(
                        "status",
                        {"message": f"Team lead: MODIFY SL={new_sl_f} TP={new_tp_f}"},
                    )
                execution = engine.executor.modify_positions(
                    symbol=symbol, new_sl=new_sl_f, new_tp=new_tp_f
                )
            else:
                if event_handler is not None:
                    event_handler("status", {"message": "Team lead: HOLD"})

        engine.logger.log_decision(
            {
                "multi_agent": True,
                "monitor": True,
                "iteration": iteration,
                "trading_mode": trading_mode,
                "trading_strategy": trading_strategy,
                "symbol": symbol,
                "agents": [
                    {
                        "role": item["role"],
                        "name": item["name"],
                        "provider": item["provider"],
                        "model": item["model"],
                    }
                    for item in agent_outputs
                ],
                "raw_response": team_lead_text,
                "monitor_decision": decision_record,
                "execution": execution,
                "position": position,
            }
        )

        if event_handler is not None:
            event_handler(
                "monitor_decision",
                {
                    "iteration": iteration,
                    "decision": decision_record,
                    "execution": execution,
                    "position": position,
                },
            )

        return {
            "position_open": True,
            "iteration": iteration,
            "snapshot": snapshot,
            "position": position,
            "agents": agent_outputs,
            "decision": decision_record,
            "execution": execution,
        }

    def run_monitor_loop(
        self,
        agents: list[AgentConfig],
        symbol: str,
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        user_prompt: str | None,
        interval_seconds: int,
        max_iterations: int,
        execute: bool,
        event_handler: EventHandler | None,
        stop_flag: Callable[[], bool] | None = None,
        prop_firm_rules: PropFirmRules | None = None,
        prop_firm_profile_id: int | None = None,
        account_mode: TradingAccountMode = "real",
    ) -> dict[str, Any]:
        import time

        roles = self._resolve_agents(agents)
        symbol = symbol.strip()

        with session_scope() as db:
            prop_firm_rules, _ = resolve_prop_firm_for_account_mode(
                db,
                account_mode=account_mode,
                inline_rules=prop_firm_rules,
                profile_id=prop_firm_profile_id,
            )

        history: list[dict[str, Any]] = []
        last_decision_action: str | None = None
        for iteration in range(1, max_iterations + 1):
            if stop_flag is not None and stop_flag():
                if event_handler is not None:
                    event_handler("status", {"message": "Monitoring stopped by user"})
                break
            try:
                outcome = self.monitor_once(
                    agents_by_role=roles,
                    symbol=symbol,
                    trading_mode=trading_mode,
                    trading_strategy=trading_strategy,
                    user_prompt=user_prompt,
                    iteration=iteration,
                    execute=execute,
                    event_handler=event_handler,
                    prop_firm_rules=prop_firm_rules,
                )
            except Exception as exc:
                self.engine.logger.log_exception("multi-agent-monitor-failed", exc)
                if event_handler is not None:
                    event_handler("error", {"error": str(exc), "iteration": iteration})
                break

            if not outcome.get("position_open"):
                if event_handler is not None:
                    event_handler(
                        "status",
                        {"message": "Position no longer open - stopping monitor"},
                    )
                break

            history.append(outcome)
            last_decision_action = outcome["decision"]["action"]

            if last_decision_action == "close":
                if event_handler is not None:
                    event_handler(
                        "status",
                        {"message": "Position closed by team lead"},
                    )
                break

            if iteration >= max_iterations:
                if event_handler is not None:
                    event_handler(
                        "status",
                        {"message": f"Monitor reached max iterations ({max_iterations})"},
                    )
                break

            sleep_remaining = max(1, int(interval_seconds))
            while sleep_remaining > 0:
                if stop_flag is not None and stop_flag():
                    break
                step = 1 if sleep_remaining > 1 else sleep_remaining
                time.sleep(step)
                sleep_remaining -= step

        result = {
            "symbol": symbol,
            "iterations": len(history),
            "history": history,
            "last_action": last_decision_action,
        }
        if event_handler is not None:
            event_handler("monitor_done", result)
        return result
