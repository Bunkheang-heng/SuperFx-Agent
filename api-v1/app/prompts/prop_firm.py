from __future__ import annotations

from app.schemas.prop_firm import PropFirmRules


def _fmt_optional_bool(label: str, value: bool | None) -> str | None:
    if value is None:
        return None
    return f"- {label}: {'yes' if value else 'no'}"


def format_prop_firm_rules_block(rules: PropFirmRules | None) -> str:
    """Turn structured prop firm rules into a prompt block for all trading agents."""
    if rules is None or not rules.enabled:
        return ""

    lines: list[str] = [
        "=== PROP FIRM / FUNDED ACCOUNT RULES (MANDATORY) ===",
        "You are trading a prop firm or funded evaluation account. Violating these rules can fail "
        "the account immediately. Prefer HOLD or NO TRADE when compliance is unclear.",
    ]

    if rules.firm_name and rules.firm_name.strip():
        lines.append(f"Firm / program: {rules.firm_name.strip()}")

    acct = rules.account_size if rules.account_size and rules.account_size > 0 else None

    def _money(pct: float | None) -> str:
        if acct is None or pct is None:
            return ""
        return f" (= {acct * pct / 100.0:,.2f} on a {acct:,.0f} account)"

    structured: list[str] = []
    if acct is not None:
        structured.append(f"- Account size: {acct:,.0f} (use this to convert all % limits to money)")
    if rules.max_daily_loss_pct is not None:
        structured.append(
            f"- Max daily loss: {rules.max_daily_loss_pct:g}%{_money(rules.max_daily_loss_pct)} (do not exceed)"
        )
    if rules.max_drawdown_pct is not None:
        structured.append(
            f"- Max overall loss / drawdown: {rules.max_drawdown_pct:g}%{_money(rules.max_drawdown_pct)} "
            "(NEVER touch this equity floor, even intraday)"
        )
    if rules.profit_target_pct is not None:
        structured.append(
            f"- Profit target: {rules.profit_target_pct:g}%{_money(rules.profit_target_pct)} (evaluation / phase goal)"
        )
    if rules.max_risk_per_trade_pct is not None:
        structured.append(
            f"- Max risk per trade: {rules.max_risk_per_trade_pct:g}%{_money(rules.max_risk_per_trade_pct)} "
            "(size lots so stop-loss distance keeps risk at or below this)"
        )
    if rules.require_stop_loss:
        structured.append("- Stop loss REQUIRED on every entry — no trade without a stop loss.")
    if rules.max_lot is not None:
        structured.append(f"- Max lot size per trade: {rules.max_lot:g}")
    if rules.max_trades_per_day is not None:
        structured.append(f"- Max new trades per day: {rules.max_trades_per_day}")
    if rules.max_open_positions is not None:
        structured.append(f"- Max simultaneous open positions: {rules.max_open_positions}")
    if rules.min_trading_days is not None:
        structured.append(f"- Minimum trading days required: {rules.min_trading_days}")
    if rules.allowed_symbols and rules.allowed_symbols.strip():
        structured.append(f"- Allowed symbols only: {rules.allowed_symbols.strip()}")
    if rules.forbidden_symbols and rules.forbidden_symbols.strip():
        structured.append(f"- Forbidden symbols: {rules.forbidden_symbols.strip()}")

    news_line = _fmt_optional_bool("News trading allowed", rules.news_trading_allowed)
    if news_line:
        structured.append(news_line)
    weekend_line = _fmt_optional_bool("Weekend / overnight holding allowed", rules.weekend_holding_allowed)
    if weekend_line:
        structured.append(weekend_line)

    if rules.consistency_rule and rules.consistency_rule.strip():
        structured.append(f"- Consistency rule: {rules.consistency_rule.strip()}")

    if structured:
        lines.append("")
        lines.append("Structured limits:")
        lines.extend(structured)

    custom = (rules.custom_rules or "").strip()
    if custom:
        lines.append("")
        lines.append("Additional firm rules (from user):")
        lines.append(custom)

    lines.append("")
    lines.append(
        "Risk manager & team lead: explicitly check each proposal against the above before approving. "
        "If a trade would breach any rule, REJECT or output HOLD with a clear reason."
    )

    return "\n".join(lines)


def format_user_context_block(
    user_prompt: str | None,
    prop_firm_rules: PropFirmRules | None,
    *,
    progress_block: str | None = None,
) -> str:
    """Combine evaluation progress, prop firm rules, and optional extra user instructions."""
    parts: list[str] = []
    if progress_block and progress_block.strip():
        parts.append(progress_block.strip())
    prop_block = format_prop_firm_rules_block(prop_firm_rules)
    if prop_block:
        parts.append(prop_block)
    extra = (user_prompt or "").strip()
    if extra:
        parts.append(f"Additional user instructions:\n{extra}")
    return "\n\n".join(parts)
