from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

try:
    import MetaTrader5 as mt5
except ImportError:  # pragma: no cover
    mt5 = None

from app.core.config import get_settings


TIMEFRAME_MAP = {
    "M1": "TIMEFRAME_M1",
    "M5": "TIMEFRAME_M5",
    "M15": "TIMEFRAME_M15",
    "M30": "TIMEFRAME_M30",
    "H1": "TIMEFRAME_H1",
    "H4": "TIMEFRAME_H4",
    "D1": "TIMEFRAME_D1",
}


class MT5ConnectorError(RuntimeError):
    pass


@dataclass(frozen=True)
class Candle:
    time: int
    open: float
    high: float
    low: float
    close: float
    tick_volume: int
    spread: int
    real_volume: int

    def as_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["time_iso"] = datetime.fromtimestamp(self.time, tz=timezone.utc).isoformat()
        return payload


class MT5Connector:
    def __init__(self) -> None:
        self.connected = False
        self.settings = get_settings()

    def connect(self, login: str | None, password: str | None, server: str | None) -> tuple[bool, str]:
        if mt5 is None:
            raise MT5ConnectorError("MetaTrader5 package is not available on this machine.")

        resolved_login = login or self.settings.mt5_login
        resolved_password = password or self.settings.mt5_password
        resolved_server = server or self.settings.mt5_server

        if not resolved_login or not resolved_password or not resolved_server:
            return False, "Missing MT5 login, password, or server."

        if not mt5.initialize(
            login=int(str(resolved_login)),
            password=str(resolved_password),
            server=str(resolved_server),
        ):
            code, message = mt5.last_error()
            return False, f"MT5 initialize failed: [{code}] {message}"

        account_info = mt5.account_info()
        if account_info is None:
            code, message = mt5.last_error()
            mt5.shutdown()
            return False, f"Unable to fetch MT5 account info: [{code}] {message}"

        account_payload = account_info._asdict()
        if self.settings.mt5_demo_only and "demo" not in str(account_payload.get("server", "")).lower():
            mt5.shutdown()
            return False, "Demo-only mode enabled; non-demo server rejected."

        self.connected = True
        return True, f"Connected to {account_payload.get('server', 'MT5')}."

    def disconnect(self) -> tuple[bool, str]:
        if mt5 is not None:
            mt5.shutdown()
        self.connected = False
        return True, "Disconnected."

    def status(self) -> dict:
        payload = {"connected": self.connected, "demo_only": self.settings.mt5_demo_only}
        if not self.connected or mt5 is None:
            return payload
        try:
            payload["account"] = self.get_account_info()
        except Exception:
            pass
        return payload

    def _require_connection(self) -> None:
        if not self.connected or mt5 is None:
            raise MT5ConnectorError("MT5 is not connected.")

    def _resolve_timeframe(self, timeframe: str) -> int:
        self._require_connection()
        attr = TIMEFRAME_MAP.get(timeframe.upper())
        if not attr:
            raise MT5ConnectorError(f"Unsupported timeframe: {timeframe}")
        value = getattr(mt5, attr, None)
        if value is None:
            raise MT5ConnectorError(f"MT5 timeframe constant unavailable for {timeframe}")
        return value

    def ensure_symbol(self, symbol: str) -> bool:
        self._require_connection()
        info = mt5.symbol_info(symbol)
        if info is None:
            return False
        if not info.visible:
            return bool(mt5.symbol_select(symbol, True))
        return True

    def get_account_info(self) -> dict[str, Any]:
        self._require_connection()
        account = mt5.account_info()
        if account is None:
            raise MT5ConnectorError("Unable to fetch MT5 account info.")
        return account._asdict()

    def get_symbol_info(self, symbol: str) -> dict[str, Any]:
        self._require_connection()
        if not self.ensure_symbol(symbol):
            raise MT5ConnectorError(f"Symbol '{symbol}' is not available in MT5.")
        info = mt5.symbol_info(symbol)
        if info is None:
            raise MT5ConnectorError(f"Unable to fetch symbol info for {symbol}.")
        return info._asdict()

    def get_tick(self, symbol: str) -> dict[str, Any]:
        self._require_connection()
        if not self.ensure_symbol(symbol):
            raise MT5ConnectorError(f"Symbol '{symbol}' is not available in MT5.")
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            raise MT5ConnectorError(f"Unable to fetch tick for {symbol}.")
        return tick._asdict()

    def get_candles(self, symbol: str, timeframe: str, count: int) -> list[Candle]:
        self._require_connection()
        if not self.ensure_symbol(symbol):
            raise MT5ConnectorError(f"Symbol '{symbol}' is not available in MT5.")
        mt5_timeframe = self._resolve_timeframe(timeframe)
        rates = mt5.copy_rates_from_pos(symbol, mt5_timeframe, 0, count)
        if rates is None or len(rates) == 0:
            raise MT5ConnectorError("Unable to fetch candle data from MT5.")
        return [Candle(**dict(zip(rates.dtype.names, row))) for row in rates]

    def get_positions(self, symbol: str | None = None) -> list[dict[str, Any]]:
        self._require_connection()
        positions = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
        if positions is None:
            return []
        return [position._asdict() for position in positions]

    def get_trade_history(
        self,
        limit: int = 200,
        offset: int = 0,
        lookback_days: int = 30,
        symbol: str | None = None,
        outcome_filter: str = "all",
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> dict[str, Any]:
        self._require_connection()

        resolved_date_to = date_to or datetime.now(timezone.utc)
        resolved_date_from = date_from or (resolved_date_to - timedelta(days=lookback_days))
        deals = mt5.history_deals_get(resolved_date_from, resolved_date_to)
        if deals is None:
            return {"items": [], "total_count": 0}

        type_map = {
            int(mt5.DEAL_TYPE_BUY): "buy",
            int(mt5.DEAL_TYPE_SELL): "sell",
            int(mt5.DEAL_TYPE_BALANCE): "balance",
            int(mt5.DEAL_TYPE_CREDIT): "credit",
            int(mt5.DEAL_TYPE_CHARGE): "charge",
            int(mt5.DEAL_TYPE_CORRECTION): "correction",
            int(mt5.DEAL_TYPE_BONUS): "bonus",
            int(mt5.DEAL_TYPE_COMMISSION): "commission",
            int(mt5.DEAL_TYPE_COMMISSION_DAILY): "commission_daily",
            int(mt5.DEAL_TYPE_COMMISSION_MONTHLY): "commission_monthly",
            int(mt5.DEAL_TYPE_COMMISSION_AGENT_DAILY): "commission_agent_daily",
            int(mt5.DEAL_TYPE_COMMISSION_AGENT_MONTHLY): "commission_agent_monthly",
            int(mt5.DEAL_TYPE_INTEREST): "interest",
            int(mt5.DEAL_TYPE_BUY_CANCELED): "buy_canceled",
            int(mt5.DEAL_TYPE_SELL_CANCELED): "sell_canceled",
        }
        entry_map = {
            int(mt5.DEAL_ENTRY_IN): "in",
            int(mt5.DEAL_ENTRY_OUT): "out",
            int(mt5.DEAL_ENTRY_INOUT): "in_out",
            int(mt5.DEAL_ENTRY_OUT_BY): "out_by",
        }

        history: list[dict[str, Any]] = []
        for deal in deals:
            payload = deal._asdict()
            if symbol and payload.get("symbol") != symbol:
                continue

            type_code = int(payload.get("type", -1))
            entry_code = int(payload.get("entry", -1))
            profit = float(payload.get("profit") or 0.0)
            if outcome_filter == "win" and profit <= 0:
                continue
            if outcome_filter == "loss" and profit >= 0:
                continue
            if outcome_filter == "breakeven" and abs(profit) > 1e-9:
                continue

            history.append(
                {
                    "ticket": payload.get("ticket"),
                    "order": payload.get("order"),
                    "position_id": payload.get("position_id"),
                    "time": int(payload.get("time", 0)),
                    "time_msc": int(payload.get("time_msc") or (int(payload.get("time", 0)) * 1000)),
                    "symbol": payload.get("symbol"),
                    "type": type_map.get(type_code, str(type_code)),
                    "entry": entry_map.get(entry_code, str(entry_code)),
                    "volume": payload.get("volume"),
                    "price": payload.get("price"),
                    "profit": profit,
                    "commission": payload.get("commission"),
                    "swap": payload.get("swap"),
                    "fee": payload.get("fee"),
                    "reason": payload.get("reason"),
                    "comment": payload.get("comment"),
                }
            )

        history.sort(key=lambda item: int(item["time_msc"]), reverse=True)
        total_count = len(history)
        start = max(offset, 0)
        end = start + max(limit, 1)
        return {
            "items": history[start:end],
            "total_count": total_count,
        }

    def get_equity_curve(self, lookback_days: int = 30) -> dict[str, Any]:
        """Rebuild equity over time from deal history (newest equity = live account)."""
        self._require_connection()
        account = self.get_account_info()
        current_equity = float(account.get("equity") or account.get("balance") or 0.0)
        now_ts = int(datetime.now(timezone.utc).timestamp())

        date_to = datetime.now(timezone.utc)
        date_from = date_to - timedelta(days=max(1, lookback_days))
        deals = mt5.history_deals_get(date_from, date_to)
        if deals is None:
            deals = []

        events: list[tuple[int, float]] = []
        for deal in deals:
            payload = deal._asdict()
            time_msc = int(payload.get("time_msc") or 0)
            ts = time_msc // 1000 if time_msc else int(payload.get("time", 0))
            net = (
                float(payload.get("profit") or 0.0)
                + float(payload.get("commission") or 0.0)
                + float(payload.get("swap") or 0.0)
                + float(payload.get("fee") or 0.0)
            )
            events.append((ts, net))
        events.sort(key=lambda item: item[0])

        points: list[dict[str, Any]] = [{"time": now_ts, "equity": round(current_equity, 2)}]
        running = current_equity
        for ts, net in reversed(events):
            running -= net
            points.append({"time": ts, "equity": round(running, 2)})
        points.reverse()

        if len(points) == 1:
            points.insert(
                0,
                {
                    "time": int(date_from.timestamp()),
                    "equity": round(current_equity, 2),
                },
            )

        points = _downsample_series(points, max_points=280)
        start_equity = float(points[0]["equity"]) if points else current_equity
        change = current_equity - start_equity
        change_pct = (change / start_equity * 100.0) if start_equity else 0.0

        return {
            "points": points,
            "current_equity": round(current_equity, 2),
            "start_equity": round(start_equity, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "lookback_days": lookback_days,
            "currency": account.get("currency"),
        }

    def get_last_closed_candle_time(self, symbol: str, timeframe: str) -> int:
        candles = self.get_candles(symbol, timeframe, 3)
        if len(candles) < 2:
            raise MT5ConnectorError("Not enough candles to detect a close.")
        return candles[-2].time

    def modify_position(
        self,
        symbol: str,
        position: dict[str, Any],
        sl: float | None,
        tp: float | None,
    ) -> dict[str, Any]:
        self._require_connection()
        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": symbol,
            "position": position["ticket"],
            "sl": float(sl) if sl is not None else float(position.get("sl") or 0.0),
            "tp": float(tp) if tp is not None else float(position.get("tp") or 0.0),
        }
        result = mt5.order_send(request)
        if result is None:
            raise MT5ConnectorError("MT5 order_send returned None while modifying position.")
        return {"request": request, "result": result._asdict()}

    def close_position(self, symbol: str, position: dict[str, Any], deviation: int) -> dict[str, Any]:
        self._require_connection()
        tick = self.get_tick(symbol)
        is_buy = int(position["type"]) == int(mt5.POSITION_TYPE_BUY)
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "position": position["ticket"],
            "volume": float(position["volume"]),
            "type": mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY,
            "price": tick["bid"] if is_buy else tick["ask"],
            "deviation": deviation,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
            "comment": "thinktrade-close",
        }
        result = mt5.order_send(request)
        if result is None:
            raise MT5ConnectorError("MT5 order_send returned None while closing position.")
        return result._asdict()

    def send_market_order(
        self,
        symbol: str,
        side: str,
        lot_size: float,
        sl: float | None,
        tp: float | None,
        deviation: int,
        comment: str = "thinktrade-order",
    ) -> dict[str, Any]:
        self._require_connection()
        tick = self.get_tick(symbol)
        upper_side = side.upper()
        if upper_side == "BUY":
            order_type = mt5.ORDER_TYPE_BUY
            price = tick["ask"]
        elif upper_side == "SELL":
            order_type = mt5.ORDER_TYPE_SELL
            price = tick["bid"]
        else:
            raise MT5ConnectorError(f"Unsupported order side: {side}")

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(lot_size),
            "type": order_type,
            "price": price,
            "deviation": deviation,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
            "comment": comment,
        }
        if sl is not None:
            request["sl"] = float(sl)
        if tp is not None:
            request["tp"] = float(tp)

        result = mt5.order_send(request)
        if result is None:
            raise MT5ConnectorError("MT5 order_send returned None.")
        return {"request": request, "result": result._asdict()}

    def send_pending_order(
        self,
        symbol: str,
        order_type: str,
        lot_size: float,
        entry_price: float,
        sl: float | None,
        tp: float | None,
        time_in_force: str = "gtc",
        cancel_if_not_filled_minutes: int | None = None,
        comment: str = "thinktrade-pending-order",
    ) -> dict[str, Any]:
        self._require_connection()
        tick = self.get_tick(symbol)
        normalized_type = order_type.upper()
        order_type_map = {
            "BUY_LIMIT": mt5.ORDER_TYPE_BUY_LIMIT,
            "SELL_LIMIT": mt5.ORDER_TYPE_SELL_LIMIT,
            "BUY_STOP": mt5.ORDER_TYPE_BUY_STOP,
            "SELL_STOP": mt5.ORDER_TYPE_SELL_STOP,
        }
        mapped_type = order_type_map.get(normalized_type)
        if mapped_type is None:
            raise MT5ConnectorError(f"Unsupported pending order type: {order_type}")

        ask = float(tick["ask"])
        bid = float(tick["bid"])
        price = float(entry_price)
        if normalized_type == "BUY_LIMIT" and price >= ask:
            raise MT5ConnectorError("BUY_LIMIT entry_price must be below current ask.")
        if normalized_type == "SELL_LIMIT" and price <= bid:
            raise MT5ConnectorError("SELL_LIMIT entry_price must be above current bid.")
        if normalized_type == "BUY_STOP" and price <= ask:
            raise MT5ConnectorError("BUY_STOP entry_price must be above current ask.")
        if normalized_type == "SELL_STOP" and price >= bid:
            raise MT5ConnectorError("SELL_STOP entry_price must be below current bid.")

        normalized_tif = time_in_force.lower().strip()
        mt5_time_type = mt5.ORDER_TIME_GTC
        expiration: int | None = None
        if cancel_if_not_filled_minutes is not None:
            expiration_dt = datetime.now(timezone.utc) + timedelta(minutes=cancel_if_not_filled_minutes)
            mt5_time_type = getattr(mt5, "ORDER_TIME_SPECIFIED", mt5.ORDER_TIME_GTC)
            expiration = int(expiration_dt.timestamp())
        elif normalized_tif == "day":
            mt5_time_type = mt5.ORDER_TIME_DAY

        request = {
            "action": mt5.TRADE_ACTION_PENDING,
            "symbol": symbol,
            "volume": float(lot_size),
            "type": mapped_type,
            "price": price,
            "type_time": mt5_time_type,
            "type_filling": getattr(mt5, "ORDER_FILLING_RETURN", mt5.ORDER_FILLING_IOC),
            "comment": comment,
        }
        if expiration is not None:
            request["expiration"] = expiration
        if sl is not None:
            request["sl"] = float(sl)
        if tp is not None:
            request["tp"] = float(tp)

        result = mt5.order_send(request)
        if result is None:
            raise MT5ConnectorError("MT5 pending order_send returned None.")
        return {"request": request, "result": result._asdict()}

    def get_recent_exit_feedback(self, symbol: str, since_time_msc: int = 0, lookback_days: int = 7) -> list[dict[str, Any]]:
        self._require_connection()
        date_to = datetime.now(timezone.utc)
        date_from = date_to - timedelta(days=lookback_days)
        deals = mt5.history_deals_get(date_from, date_to)
        if deals is None:
            return []

        feedback: list[dict[str, Any]] = []
        for deal in deals:
            payload = deal._asdict()
            if payload.get("symbol") != symbol:
                continue
            time_msc = int(payload.get("time_msc") or (int(payload.get("time", 0)) * 1000))
            if time_msc <= since_time_msc:
                continue
            if int(payload.get("entry", -1)) != int(mt5.DEAL_ENTRY_OUT):
                continue

            reason = int(payload.get("reason", -1))
            if reason == int(mt5.DEAL_REASON_TP):
                outcome = "tp-hit"
            elif reason == int(mt5.DEAL_REASON_SL):
                outcome = "sl-hit"
            else:
                continue

            feedback.append(
                {
                    "time": int(payload.get("time", 0)),
                    "time_msc": time_msc,
                    "symbol": payload.get("symbol"),
                    "outcome": outcome,
                    "profit": payload.get("profit"),
                    "volume": payload.get("volume"),
                    "price": payload.get("price"),
                    "position_id": payload.get("position_id"),
                    "order": payload.get("order"),
                    "deal": payload.get("ticket"),
                    "comment": payload.get("comment"),
                }
            )

        feedback.sort(key=lambda item: int(item["time_msc"]))
        return feedback


def _downsample_series(points: list[dict[str, Any]], *, max_points: int) -> list[dict[str, Any]]:
    if len(points) <= max_points:
        return points
    step = max(1, (len(points) - 1) // (max_points - 1))
    sampled = [points[0]]
    for index in range(step, len(points) - 1, step):
        sampled.append(points[index])
    if points[-1] is not sampled[-1]:
        sampled.append(points[-1])
    return sampled
