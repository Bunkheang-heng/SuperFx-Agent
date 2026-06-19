from typing import Literal
from pydantic import BaseModel, Field

TradeAction = Literal["hold", "buy", "sell", "buy_limit", "sell_limit", "buy_stop", "sell_stop"]
TimeInForce = Literal["gtc", "day"]


class TradeDecision(BaseModel):
    symbol: str = Field(min_length=3, max_length=20)
    action: TradeAction
    confidence: float = Field(ge=0.0, le=1.0)
    reason: str = Field(min_length=1, max_length=2000)
    lot_size: float = Field(default=0.01, ge=0.0, le=100.0)
    entry_price: float | None = None
    stop_loss: float | None = None
    take_profit: float | None = None
    time_in_force: TimeInForce = "gtc"
    cancel_if_not_filled_minutes: int | None = Field(default=None, ge=1, le=1440)
