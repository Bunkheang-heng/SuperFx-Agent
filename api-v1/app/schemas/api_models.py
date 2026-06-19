from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field
from app.schemas.decision import TradeDecision
from app.schemas.prop_firm import PropFirmRules

LLMProvider = Literal["openai", "gemini", "sealion"]
TradingMode = Literal["auto", "aggressive", "scalper", "day_trader", "swing_trader", "breakout", "mean_reversion"]
TradingStrategy = Literal[
    "none",
    "smc",
    "ict",
    "supply_demand",
    "support_resistance",
    "trend_following",
    "breakout_retest",
]
TradingAccountMode = Literal["real", "demo", "prop_firm"]


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "thinktrade-backend"
    timestamp: datetime


class ConnectRequest(BaseModel):
    login: str | None = None
    password: str | None = None
    server: str | None = None


class GenericResponse(BaseModel):
    success: bool
    message: str
    data: dict[str, Any] = Field(default_factory=dict)


class RunCycleRequest(BaseModel):
    wait_for_new_candle: bool = True
    provider: LLMProvider
    model: str | None = None
    symbol: str = Field(default="EURUSDm", min_length=3, max_length=20)
    trading_mode: TradingMode = "auto"
    trading_strategy: TradingStrategy = "none"
    user_prompt: str | None = Field(default=None, max_length=1200)
    account_mode: TradingAccountMode = "real"
    prop_firm_rules: PropFirmRules | None = None
    prop_firm_profile_id: int | None = Field(default=None, ge=1)


class PositionInsightRequest(BaseModel):
    provider: LLMProvider
    model: str | None = None
    question: str = Field(min_length=3, max_length=4000)


class ProviderInfo(BaseModel):
    provider: LLMProvider
    default_model: str
    configured: bool


class ProvidersResponse(BaseModel):
    providers: list[ProviderInfo]


class RunCycleResponse(BaseModel):
    success: bool
    message: str
    decision: TradeDecision | None = None
    result: dict[str, Any] = Field(default_factory=dict)


class PositionInsightResponse(BaseModel):
    success: bool
    message: str
    result: dict[str, Any] = Field(default_factory=dict)


AgentRole = Literal["analyst", "strategist", "risk_manager", "team_lead"]
AgentProvider = Literal["openai", "gemini", "sealion", "openai_compatible"]
DeskMode = Literal["standard", "prop_firm"]


class AgentConfig(BaseModel):
    role: AgentRole
    name: str | None = Field(default=None, max_length=80)
    provider: AgentProvider
    api_key: str = Field(min_length=1, max_length=512)
    model: str = Field(min_length=1, max_length=200)
    base_url: str | None = Field(default=None, max_length=400)
    system_prompt: str | None = Field(default=None, max_length=8000)
    skills: str | None = Field(
        default=None,
        max_length=6000,
        description="Extra playbook text appended to this agent's system prompt (on top of the role default or override).",
    )
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)


class MultiAgentRunRequest(BaseModel):
    agents: list[AgentConfig] = Field(min_length=4, max_length=4)
    symbol: str = Field(default="EURUSDm", min_length=3, max_length=20)
    wait_for_new_candle: bool = True
    trading_mode: TradingMode = "auto"
    trading_strategy: TradingStrategy = "none"
    user_prompt: str | None = Field(default=None, max_length=1200)
    account_mode: TradingAccountMode = "real"
    prop_firm_rules: PropFirmRules | None = None
    prop_firm_profile_id: int | None = Field(default=None, ge=1)
    desk_mode: DeskMode = "standard"
    execute: bool = True


class AutoTradeRequest(BaseModel):
    """Continuous loop: full entry desk -> monitor while position open -> cooldown -> repeat until stopped."""

    agents: list[AgentConfig] = Field(min_length=4, max_length=4)
    symbol: str = Field(default="EURUSDm", min_length=3, max_length=20)
    wait_for_new_candle: bool = True
    trading_mode: TradingMode = "auto"
    trading_strategy: TradingStrategy = "none"
    user_prompt: str | None = Field(default=None, max_length=1200)
    account_mode: TradingAccountMode = "real"
    prop_firm_rules: PropFirmRules | None = None
    prop_firm_profile_id: int | None = Field(default=None, ge=1)
    desk_mode: DeskMode = "standard"
    execute: bool = True
    entry_interval_seconds: int = Field(
        default=120,
        ge=0,
        le=7200,
        description="Wait time after a flat entry cycle (no open position) before the next full desk review.",
    )
    monitor_interval_seconds: int = Field(default=30, ge=5, le=600)
    monitor_max_iterations: int = Field(
        default=100_000,
        ge=1,
        le=500_000,
        description="Safety cap on monitor cycles per open position before returning to entry.",
    )


class AgentRunOutput(BaseModel):
    role: AgentRole
    name: str | None = None
    provider: str
    model: str
    prompt: str
    output: str
    error: str | None = None


class MultiAgentRunResult(BaseModel):
    symbol: str
    trading_mode: TradingMode
    trading_strategy: TradingStrategy
    snapshot: dict[str, Any]
    agents: list[AgentRunOutput]
    decision: dict[str, Any] | None = None
    execution: dict[str, Any] = Field(default_factory=dict)
    exit_feedback: dict[str, Any] | None = None
    executed: bool = False


class MultiAgentRunResponse(BaseModel):
    success: bool
    message: str
    result: MultiAgentRunResult


class AgentHealthCheckRequest(BaseModel):
    provider: AgentProvider
    api_key: str = Field(min_length=1, max_length=512)
    model: str = Field(min_length=1, max_length=200)
    base_url: str | None = Field(default=None, max_length=400)


class AgentHealthCheckResponse(BaseModel):
    success: bool
    provider: str
    model: str
    sample: str | None = None
    error: str | None = None


MonitorAction = Literal["hold", "close", "modify"]


class MonitorRequest(BaseModel):
    agents: list[AgentConfig] = Field(min_length=4, max_length=4)
    symbol: str = Field(default="EURUSDm", min_length=3, max_length=20)
    trading_mode: TradingMode = "auto"
    trading_strategy: TradingStrategy = "none"
    user_prompt: str | None = Field(default=None, max_length=1200)
    account_mode: TradingAccountMode = "real"
    prop_firm_rules: PropFirmRules | None = None
    prop_firm_profile_id: int | None = Field(default=None, ge=1)
    desk_mode: DeskMode = "standard"
    interval_seconds: int = Field(default=30, ge=5, le=600)
    max_iterations: int = Field(default=120, ge=1, le=2000)
    execute: bool = True


class MonitorDecision(BaseModel):
    action: MonitorAction
    new_stop_loss: float | None = None
    new_take_profit: float | None = None
    reason: str


class EquityCurvePoint(BaseModel):
    time: int
    equity: float


class EquityCurveResponse(BaseModel):
    points: list[EquityCurvePoint]
    current_equity: float
    start_equity: float
    change: float
    change_pct: float
    lookback_days: int
    currency: str | None = None
