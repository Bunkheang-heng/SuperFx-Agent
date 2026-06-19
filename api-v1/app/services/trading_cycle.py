from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.db.session import session_scope
from app.schemas.api_models import TradingAccountMode
from app.schemas.decision import TradeDecision
from app.schemas.prop_firm import PropFirmRules
from app.services.profile_store import resolve_prop_firm_rules
from app.services.prop_compliance import ComplianceCheckResult, PropComplianceService, blocked_execution_result
from app.services.run_recorder import RunRecorder


def resolve_prop_firm_for_account_mode(
    db: Session,
    *,
    account_mode: TradingAccountMode,
    inline_rules: PropFirmRules | None,
    profile_id: int | None,
) -> tuple[PropFirmRules | None, int | None]:
    """Only prop firm mode uses saved profiles and compliance rules."""
    if account_mode != "prop_firm":
        return None, None
    return resolve_prop_firm_rules(
        db,
        inline_rules=inline_rules,
        profile_id=profile_id,
        use_active_profile=True,
    )


def execute_decision_with_compliance(
    engine: Any,
    *,
    decision: TradeDecision,
    symbol: str,
    snapshot: dict[str, Any],
    account_info: dict[str, Any],
    open_position_count: int,
    prop_firm_rules: PropFirmRules | None,
    prop_firm_profile_id: int | None,
    should_execute: bool,
    account_mode: TradingAccountMode = "real",
) -> tuple[dict[str, Any], bool, ComplianceCheckResult, int | None]:
    """Resolve rules, run compliance, optionally execute. Returns execution, executed, compliance, profile_id."""
    compliance = ComplianceCheckResult(passed=True, summary="No execution requested")
    resolved_profile_id = prop_firm_profile_id
    execution: dict[str, Any] = {}

    try:
        with session_scope() as db:
            resolved_rules, resolved_profile_id = resolve_prop_firm_for_account_mode(
                db,
                account_mode=account_mode,
                inline_rules=prop_firm_rules,
                profile_id=prop_firm_profile_id,
            )
            compliance = PropComplianceService(db).evaluate(
                rules=resolved_rules,
                snapshot=snapshot,
                decision=decision,
                symbol=symbol,
                account_info=account_info,
                open_position_count=open_position_count,
            )

            if not should_execute:
                return {}, False, compliance, resolved_profile_id

            if decision.action == "hold":
                execution = engine.executor.execute(decision, symbol)
            elif compliance.passed:
                execution = engine.executor.execute(decision, symbol)
            else:
                execution = blocked_execution_result(compliance.summary)

            executed = bool(execution.get("executed"))
            return execution, executed, compliance, resolved_profile_id
    except Exception as exc:
        engine.logger.log_exception("compliance-execute-failed", exc)
        if should_execute and not execution:
            execution = engine.executor.execute(decision, symbol)
            executed = bool(execution.get("executed"))
            compliance = ComplianceCheckResult(
                passed=True,
                summary="Compliance DB error — executed without guard",
            )
            return execution, executed, compliance, prop_firm_profile_id
        return execution, False, compliance, prop_firm_profile_id


def record_trading_run(
    engine: Any,
    *,
    run_type: str,
    symbol: str,
    trading_mode: str,
    trading_strategy: str,
    snapshot: dict[str, Any],
    decision: TradeDecision,
    execution: dict[str, Any],
    executed: bool,
    compliance: ComplianceCheckResult,
    prop_firm_profile_id: int | None,
    provider: str | None = None,
    model: str | None = None,
    user_prompt: str | None = None,
    agent_outputs: list[dict[str, Any]] | None = None,
    raw_response: str | None = None,
) -> int | None:
    try:
        with session_scope() as db:
            run = RunRecorder(db).record_run(
                run_type=run_type,
                symbol=symbol,
                trading_mode=trading_mode,
                trading_strategy=trading_strategy,
                snapshot=snapshot,
                decision=decision,
                execution=execution,
                executed=executed,
                compliance=compliance,
                prop_firm_profile_id=prop_firm_profile_id,
                provider=provider,
                model=model,
                user_prompt=user_prompt,
                agent_outputs=agent_outputs,
                raw_response=raw_response,
            )
            return run.id
    except Exception as exc:
        engine.logger.log_exception("record-trading-run-failed", exc)
        return None
