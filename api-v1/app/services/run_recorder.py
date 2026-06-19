from __future__ import annotations

import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import AccountSnapshot, AgentMessage, ComplianceEvent, TradingRun
from app.schemas.decision import TradeDecision
from app.services.prop_compliance import ComplianceCheckResult


class RunRecorder:
  def __init__(self, db: Session) -> None:
    self.db = db

  def record_run(
    self,
    *,
    run_type: str,
    symbol: str,
    trading_mode: str,
    trading_strategy: str,
    snapshot: dict[str, Any],
    decision: TradeDecision | dict[str, Any] | None,
    execution: dict[str, Any] | None,
    executed: bool,
    compliance: ComplianceCheckResult | None,
    prop_firm_profile_id: int | None = None,
    provider: str | None = None,
    model: str | None = None,
    user_prompt: str | None = None,
    agent_outputs: list[dict[str, Any]] | None = None,
    raw_response: str | None = None,
  ) -> TradingRun:
    decision_dict = _decision_dump(decision)
    run = TradingRun(
      run_type=run_type,
      symbol=symbol,
      trading_mode=trading_mode,
      trading_strategy=trading_strategy,
      provider=provider,
      model=model,
      prop_firm_profile_id=prop_firm_profile_id,
      user_prompt=user_prompt,
      decision_json=json.dumps(decision_dict, default=str) if decision_dict else None,
      execution_json=json.dumps(execution or {}, default=str),
      executed=executed,
      compliance_passed=compliance.passed if compliance else None,
      compliance_summary=compliance.summary if compliance else None,
    )
    self.db.add(run)
    self.db.flush()

    account = snapshot.get("account") or {}
    self.db.add(
      AccountSnapshot(
        run_id=run.id,
        balance=_float(account.get("balance")),
        equity=_float(account.get("equity")),
        margin_free=_float(account.get("margin_free")),
        profit=_float(account.get("profit")),
        leverage=_int(account.get("leverage")),
        snapshot_json=json.dumps(
          {"market": _slim_snapshot(snapshot), "account": account},
          default=str,
        ),
      )
    )

    if compliance and compliance.events:
      for seq, evt in enumerate(compliance.events):
        self.db.add(
          ComplianceEvent(
            run_id=run.id,
            rule_key=evt["rule_key"],
            passed=evt["passed"],
            message=evt["message"],
            details_json=json.dumps(evt.get("details"), default=str) if evt.get("details") else None,
          )
        )

    if agent_outputs:
      for seq, item in enumerate(agent_outputs):
        self.db.add(
          AgentMessage(
            run_id=run.id,
            role=str(item.get("role", "")),
            name=item.get("name"),
            provider=str(item.get("provider", "")),
            model=str(item.get("model", "")),
            prompt=str(item.get("prompt", ""))[:500_000],
            output=str(item.get("output", ""))[:500_000],
            error=item.get("error"),
            sequence=seq,
          )
        )
    elif raw_response and run_type == "single_agent":
      self.db.add(
        AgentMessage(
          run_id=run.id,
          role="single_agent",
          provider=provider or "",
          model=model or "",
          prompt="",
          output=raw_response[:500_000],
          sequence=0,
        )
      )

    self.db.flush()
    return run

  def get_run(self, run_id: int) -> TradingRun | None:
    return self.db.get(TradingRun, run_id)

  def count_runs(self, *, symbol: str | None = None) -> int:
    stmt = select(func.count()).select_from(TradingRun)
    if symbol:
      stmt = stmt.where(TradingRun.symbol == symbol.strip())
    return int(self.db.scalar(stmt) or 0)

  def list_runs(self, *, limit: int = 50, offset: int = 0, symbol: str | None = None) -> list[TradingRun]:
    stmt = select(TradingRun).order_by(TradingRun.created_at.desc()).offset(offset).limit(limit)
    if symbol:
      stmt = stmt.where(TradingRun.symbol == symbol.strip())
    return list(self.db.scalars(stmt))


def _decision_dump(decision: TradeDecision | dict[str, Any] | None) -> dict[str, Any] | None:
  if decision is None:
    return None
  if isinstance(decision, TradeDecision):
    return decision.model_dump()
  return decision


def _float(value: Any) -> float | None:
  if value is None:
    return None
  try:
    return float(value)
  except (TypeError, ValueError):
    return None


def _int(value: Any) -> int | None:
  if value is None:
    return None
  try:
    return int(value)
  except (TypeError, ValueError):
    return None


def _slim_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
  return {
    "symbol": snapshot.get("symbol"),
    "timeframe": snapshot.get("timeframe"),
    "tick": snapshot.get("tick"),
    "indicators": snapshot.get("indicators"),
    "market_context": snapshot.get("market_context"),
    "position": snapshot.get("position"),
    "timestamp": snapshot.get("timestamp"),
  }
