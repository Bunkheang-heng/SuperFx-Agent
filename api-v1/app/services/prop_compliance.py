from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import AccountDayState, ComplianceEvent, TradingRun
from app.prompts.prop_firm_desk import compute_evaluation_metrics
from app.schemas.decision import TradeDecision
from app.schemas.prop_firm import PropFirmRules


@dataclass
class ComplianceCheckResult:
  passed: bool
  summary: str
  events: list[dict[str, Any]] = field(default_factory=list)


class PropComplianceService:
  def __init__(self, db: Session) -> None:
    self.db = db

  def evaluate(
    self,
    *,
    rules: PropFirmRules | None,
    snapshot: dict[str, Any],
    decision: TradeDecision,
    symbol: str,
    account_info: dict[str, Any] | None = None,
    open_position_count: int = 0,
  ) -> ComplianceCheckResult:
    if rules is None or not rules.enabled:
      return ComplianceCheckResult(passed=True, summary="No prop firm rules enabled")

    if decision.action == "hold":
      return ComplianceCheckResult(passed=True, summary="HOLD — compliance skipped")

    events: list[dict[str, Any]] = []
    account = account_info or snapshot.get("account") or {}
    balance = _float(account.get("balance"))
    equity = _float(account.get("equity"))
    login = str((account_info or {}).get("login") or account.get("login") or "default")
    server = str(account.get("server") or "mt5")
    account_key = f"{server}:{login}"

    self._update_day_state(account_key, balance, equity)

    symbol_upper = symbol.strip().upper()
    allowed = _parse_symbol_list(rules.allowed_symbols)
    forbidden = _parse_symbol_list(rules.forbidden_symbols)

    if allowed and symbol_upper not in allowed:
      events.append(_event("allowed_symbols", False, f"Symbol {symbol} not in allowed list"))
    if forbidden and symbol_upper in forbidden:
      events.append(_event("forbidden_symbols", False, f"Symbol {symbol} is forbidden"))

    if rules.require_stop_loss and (decision.stop_loss is None or decision.stop_loss == 0):
      events.append(
        _event(
          "require_stop_loss",
          False,
          "Stop loss is required on every entry (firm rule) but the decision has none",
          {"action": decision.action},
        )
      )

    if rules.max_lot is not None and decision.lot_size > rules.max_lot:
      events.append(
        _event(
          "max_lot",
          False,
          f"Lot size {decision.lot_size} exceeds max {rules.max_lot}",
          {"lot_size": decision.lot_size, "max_lot": rules.max_lot},
        )
      )

    open_count = open_position_count
    if open_count == 0 and snapshot.get("position"):
      open_count = 1
    if rules.max_open_positions is not None and open_count >= rules.max_open_positions:
      events.append(
        _event(
          "max_open_positions",
          False,
          f"Already at {open_count} open position(s); max is {rules.max_open_positions}",
        )
      )

    if rules.max_trades_per_day is not None:
      trades_today = self._count_executed_runs_today()
      if trades_today >= rules.max_trades_per_day:
        events.append(
          _event(
            "max_trades_per_day",
            False,
            f"Max trades per day ({rules.max_trades_per_day}) reached; have {trades_today}",
          )
        )

    day_state = self._get_day_state(account_key)
    baseline = day_state.baseline_balance if day_state else balance
    metrics = compute_evaluation_metrics(
        rules=rules,
        balance=balance,
        equity=equity,
        baseline_balance=baseline,
        peak_equity=day_state.peak_equity if day_state else equity,
    )
    if metrics.get("target_met"):
      events.append(
        _event(
          "profit_target_met",
          False,
          "Profit target reached — no new entries allowed (HOLD or manage open positions only)",
          {"profit_pct": metrics.get("profit_pct"), "profit_target_pct": metrics.get("profit_target_pct")},
        )
      )

    if day_state and equity is not None:
      if rules.max_daily_loss_pct is not None and day_state.baseline_balance > 0:
        daily_loss_pct = max(0.0, (day_state.baseline_balance - equity) / day_state.baseline_balance * 100)
        if daily_loss_pct >= rules.max_daily_loss_pct:
          events.append(
            _event(
              "max_daily_loss_pct",
              False,
              f"Daily loss {daily_loss_pct:.2f}% exceeds limit {rules.max_daily_loss_pct}%",
              {"daily_loss_pct": daily_loss_pct},
            )
          )
      if rules.max_drawdown_pct is not None and day_state.peak_equity > 0:
        dd_pct = max(0.0, (day_state.peak_equity - equity) / day_state.peak_equity * 100)
        if dd_pct >= rules.max_drawdown_pct:
          events.append(
            _event(
              "max_drawdown_pct",
              False,
              f"Drawdown {dd_pct:.2f}% exceeds limit {rules.max_drawdown_pct}%",
              {"drawdown_pct": dd_pct},
            )
          )

    failed = [e for e in events if not e["passed"]]
    if failed:
      summary = "; ".join(e["message"] for e in failed)
      return ComplianceCheckResult(passed=False, summary=summary, events=events)

    if not events:
      events.append(_event("prop_firm", True, "All configured checks passed"))
    return ComplianceCheckResult(
      passed=True,
      summary="Prop firm compliance passed",
      events=events,
    )

  def _update_day_state(self, account_key: str, balance: float | None, equity: float | None) -> None:
    if balance is None or equity is None:
      return
    today = date.today()
    row = self.db.scalar(
      select(AccountDayState).where(
        AccountDayState.day == today,
        AccountDayState.account_key == account_key,
      )
    )
    if row is None:
      self.db.add(
        AccountDayState(
          day=today,
          account_key=account_key,
          baseline_balance=balance,
          peak_equity=equity,
        )
      )
    else:
      row.peak_equity = max(row.peak_equity, equity)
    self.db.flush()

  def _get_day_state(self, account_key: str) -> AccountDayState | None:
    return self.db.scalar(
      select(AccountDayState).where(
        AccountDayState.day == date.today(),
        AccountDayState.account_key == account_key,
      )
    )

  def _count_executed_runs_today(self) -> int:
    start = datetime.combine(date.today(), datetime.min.time(), tzinfo=timezone.utc)
    count = self.db.scalar(
      select(func.count())
      .select_from(TradingRun)
      .where(
        TradingRun.executed.is_(True),
        TradingRun.created_at >= start,
      )
    )
    return int(count or 0)


def _float(value: Any) -> float | None:
  if value is None:
    return None
  try:
    return float(value)
  except (TypeError, ValueError):
    return None


def _parse_symbol_list(raw: str | None) -> set[str]:
  if not raw or not raw.strip():
    return set()
  return {s.strip().upper() for s in raw.split(",") if s.strip()}


def _event(rule_key: str, passed: bool, message: str, details: dict | None = None) -> dict[str, Any]:
  return {
    "rule_key": rule_key,
    "passed": passed,
    "message": message,
    "details": details,
  }


def blocked_execution_result(reason: str) -> dict[str, Any]:
  return {
    "attempted": False,
    "executed": False,
    "is_pending": False,
    "status": "blocked_prop_firm",
    "decision_action": None,
    "lot_size": 0.0,
    "order_result": None,
    "retcode": None,
    "reject_reason": reason,
    "prop_firm_blocked": True,
  }
