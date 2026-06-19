from __future__ import annotations

from typing import Any

from app.schemas.prop_firm import PropFirmRules

PROP_FIRM_ANALYST_SYSTEM = (
    "You are the ANALYST on a PROP FIRM / FUNDED ACCOUNT trading desk.\n"
    "Your trader must pass an evaluation or stay within funded rules. Every read must reference:\n"
    "- Distance to the PROFIT TARGET (primary goal)\n"
    "- Remaining room before max daily loss and max drawdown\n"
    "- Whether new risk is justified vs account phase (building toward target vs protecting gains)\n"
    "Be specific with numbers from the snapshot and evaluation progress block. No trade JSON."
)

PROP_FIRM_STRATEGIST_SYSTEM = (
    "You are the STRATEGIST on a PROP FIRM trading desk.\n"
    "Design setups that help reach the profit target WITHOUT breaching firm limits.\n"
    "If profit target is already met, recommend NO NEW TRADES — only managing existing exposure if any.\n"
    "If close to target, favor smaller size and high-quality setups only. State R-multiple and invalidation."
)

PROP_FIRM_RISK_MANAGER_SYSTEM = (
    "You are the RISK MANAGER on a PROP FIRM trading desk.\n"
    "Your job is to protect the account and the evaluation. Score each setup 1-5 on:\n"
    "target progress fit, loss-limit headroom, drawdown headroom, location, R-multiple.\n"
    "REJECT any setup that risks daily loss, max drawdown, or would be reckless when profit target is near/already hit.\n"
    "End with APPROVE / APPROVE WITH ADJUSTMENTS / REJECT and a lot cap."
)

PROP_FIRM_TEAM_LEAD_EXTRA = (
    "\n\nPROP FIRM TEAM LEAD RULES:\n"
    "- Primary objective: reach profit target before breaching loss/drawdown limits.\n"
    "- If evaluation progress shows TARGET MET: output HOLD only (no new entries). Manage open trades via monitor flow.\n"
    "- If near target (>85% of profit target): only take exceptional setups; prefer HOLD.\n"
    "- Never approve a trade that violates the prop firm rules block in the user message.\n"
    "- In your reason, cite profit target status and remaining loss/drawdown headroom.\n"
)


def compute_evaluation_metrics(
    *,
    rules: PropFirmRules | None,
    balance: float | None,
    equity: float | None,
    baseline_balance: float | None,
    peak_equity: float | None,
) -> dict[str, Any]:
    """Compute profit toward target and headroom on loss/drawdown."""
    account_size = rules.account_size if rules and rules.account_size and rules.account_size > 0 else None
    bal = balance if balance is not None else baseline_balance
    eq = equity
    base = baseline_balance if baseline_balance and baseline_balance > 0 else (bal or account_size)
    peak = peak_equity if peak_equity and peak_equity > 0 else eq

    profit_pct: float | None = None
    if base and base > 0 and eq is not None:
        profit_pct = (eq - base) / base * 100.0

    target = rules.profit_target_pct if rules else None
    target_met = False
    progress_to_target_pct: float | None = None
    remaining_to_target_pct: float | None = None
    if target is not None and target > 0 and profit_pct is not None:
        progress_to_target_pct = min(100.0, max(0.0, profit_pct / target * 100.0))
        remaining_to_target_pct = max(0.0, target - profit_pct)
        target_met = profit_pct >= target

    daily_loss_pct: float | None = None
    if base and base > 0 and eq is not None:
        daily_loss_pct = max(0.0, (base - eq) / base * 100.0)

    drawdown_pct: float | None = None
    if peak and peak > 0 and eq is not None:
        drawdown_pct = max(0.0, (peak - eq) / peak * 100.0)

    return {
        "balance": bal,
        "equity": eq,
        "baseline_balance": base,
        "profit_pct": profit_pct,
        "profit_target_pct": target,
        "progress_to_target_pct": progress_to_target_pct,
        "remaining_to_target_pct": remaining_to_target_pct,
        "target_met": target_met,
        "daily_loss_pct": daily_loss_pct,
        "max_daily_loss_pct": rules.max_daily_loss_pct if rules else None,
        "drawdown_pct": drawdown_pct,
        "max_drawdown_pct": rules.max_drawdown_pct if rules else None,
    }


def format_prop_firm_progress_block(metrics: dict[str, Any]) -> str:
    lines = [
        "=== EVALUATION PROGRESS (live) ===",
    ]
    if metrics.get("equity") is not None and metrics.get("baseline_balance") is not None:
        lines.append(
            f"Equity: {metrics['equity']:.2f} | Evaluation baseline: {metrics['baseline_balance']:.2f}"
        )
    if metrics.get("profit_pct") is not None:
        lines.append(f"Current profit: {metrics['profit_pct']:.2f}%")
    if metrics.get("profit_target_pct") is not None:
        lines.append(f"Profit target: {metrics['profit_target_pct']:.2f}%")
    if metrics.get("progress_to_target_pct") is not None:
        lines.append(f"Progress toward target: {metrics['progress_to_target_pct']:.1f}%")
    if metrics.get("remaining_to_target_pct") is not None:
        lines.append(f"Remaining to target: {metrics['remaining_to_target_pct']:.2f}%")
    if metrics.get("target_met"):
        lines.append("STATUS: PROFIT TARGET MET — do not open new positions; HOLD or manage exits only.")
    if metrics.get("daily_loss_pct") is not None and metrics.get("max_daily_loss_pct") is not None:
        lines.append(
            f"Daily loss: {metrics['daily_loss_pct']:.2f}% / max {metrics['max_daily_loss_pct']:.2f}%"
        )
    if metrics.get("drawdown_pct") is not None and metrics.get("max_drawdown_pct") is not None:
        lines.append(
            f"Drawdown from peak: {metrics['drawdown_pct']:.2f}% / max {metrics['max_drawdown_pct']:.2f}%"
        )
    return "\n".join(lines)
