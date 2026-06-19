from __future__ import annotations

from datetime import datetime, timezone
from statistics import mean
from typing import Any

from app.services.mt5_connector import Candle


def _sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return mean(values[-period:])


def _rsi(values: list[float], period: int = 14) -> float | None:
    if len(values) <= period:
        return None
    gains: list[float] = []
    losses: list[float] = []
    for i in range(-period, 0):
        delta = values[i] - values[i - 1]
        gains.append(max(delta, 0))
        losses.append(abs(min(delta, 0)))
    avg_gain = mean(gains)
    avg_loss = mean(losses)
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _atr(candles: list[Candle], period: int = 14) -> float | None:
    if len(candles) <= period:
        return None
    true_ranges: list[float] = []
    for i in range(len(candles) - period, len(candles)):
        current = candles[i]
        prev_close = candles[i - 1].close
        tr = max(
            current.high - current.low,
            abs(current.high - prev_close),
            abs(current.low - prev_close),
        )
        true_ranges.append(tr)
    return mean(true_ranges)


class MarketSnapshotService:
    def capture(
        self,
        *,
        symbol: str,
        timeframe: str,
        candles: list[Candle],
        tick: dict[str, Any],
        account_info: dict[str, Any],
        positions: list[dict[str, Any]],
    ) -> dict:
        closes = [c.close for c in candles]
        spread = float(tick["ask"]) - float(tick["bid"])
        open_position = positions[0] if positions else None
        latest_candle = candles[-1]
        utc_dt = datetime.fromtimestamp(int(tick["time"]), tz=timezone.utc)

        hour = utc_dt.hour
        if 0 <= hour < 7:
            session = "asia"
        elif 7 <= hour < 13:
            session = "london"
        elif 13 <= hour < 21:
            session = "new_york"
        else:
            session = "after_hours"

        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "tick": {
                "bid": float(tick["bid"]),
                "ask": float(tick["ask"]),
                "spread": spread,
                "time": int(tick["time"]),
            },
            "candles": [c.as_dict() for c in candles],
            "indicators": {
                "sma_10": _sma(closes, 10),
                "sma_20": _sma(closes, 20),
                "rsi_14": _rsi(closes, 14),
                "atr_14": _atr(candles, 14),
            },
            "market_context": {
                "utc_hour": hour,
                "weekday": utc_dt.strftime("%A"),
                "session": session,
                "candle_count": len(candles),
                "latest_candle_range": latest_candle.high - latest_candle.low,
                "latest_candle_body": abs(latest_candle.close - latest_candle.open),
            },
            "position": open_position,
            "account": {
                "balance": account_info.get("balance"),
                "equity": account_info.get("equity"),
                "margin_free": account_info.get("margin_free"),
                "leverage": account_info.get("leverage"),
                "server": account_info.get("server"),
            },
            "timestamp": utc_dt.isoformat(),
        }
