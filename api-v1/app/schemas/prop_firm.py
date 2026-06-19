from pydantic import BaseModel, Field


class PropFirmRules(BaseModel):
    """Structured + free-text prop firm / funded-account constraints for the AI desk."""

    enabled: bool = False
    firm_name: str | None = Field(default=None, max_length=120)
    custom_rules: str | None = Field(
        default=None,
        max_length=8000,
        description="Firm-specific rule text pasted from the prop firm handbook or dashboard.",
    )
    max_daily_loss_pct: float | None = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Max daily loss as % of starting balance or equity (firm-specific).",
    )
    max_drawdown_pct: float | None = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Max trailing or static drawdown % before account breach.",
    )
    profit_target_pct: float | None = Field(
        default=None,
        ge=0.0,
        le=1000.0,
        description="Profit target % to pass evaluation or reach payout tier.",
    )
    account_size: float | None = Field(
        default=None,
        ge=0.0,
        le=100_000_000.0,
        description="Nominal account / starting balance (account currency). Used to show $ targets and limits.",
    )
    max_risk_per_trade_pct: float | None = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="Max risk per single trade as % of account (firm rule, e.g. Hola Prime 2%).",
    )
    require_stop_loss: bool | None = Field(
        default=None,
        description="If true, every entry must carry a stop loss (hard-blocked otherwise).",
    )
    max_lot: float | None = Field(default=None, ge=0.0, le=1000.0)
    max_trades_per_day: int | None = Field(default=None, ge=0, le=500)
    max_open_positions: int | None = Field(default=None, ge=0, le=50)
    min_trading_days: int | None = Field(default=None, ge=0, le=365)
    allowed_symbols: str | None = Field(
        default=None,
        max_length=500,
        description="Comma-separated symbols allowed (e.g. XAUUSDm,EURUSDm). Empty = no whitelist.",
    )
    forbidden_symbols: str | None = Field(default=None, max_length=500)
    news_trading_allowed: bool | None = Field(
        default=None,
        description="None = not specified; False = avoid high-impact news windows.",
    )
    weekend_holding_allowed: bool | None = Field(default=None)
    consistency_rule: str | None = Field(
        default=None,
        max_length=2000,
        description="e.g. best day cannot exceed 30% of total profit.",
    )
