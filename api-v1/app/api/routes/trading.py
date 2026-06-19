import json
import queue
import threading
from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.schemas.api_models import (
    ConnectRequest,
    GenericResponse,
    PositionInsightRequest,
    PositionInsightResponse,
    ProviderInfo,
    ProvidersResponse,
    RunCycleRequest,
    RunCycleResponse,
    TradingAccountMode,
    TradingMode,
    TradingStrategy,
)
from app.schemas.prop_firm import PropFirmRules
from app.services.engine import engine

router = APIRouter(prefix="/api/trading", tags=["trading"])


@router.post("/connect", response_model=GenericResponse)
def connect(payload: ConnectRequest) -> GenericResponse:
    ok, msg = engine.connect(payload.login, payload.password, payload.server)
    return GenericResponse(success=ok, message=msg, data=engine.get_status())


@router.post("/disconnect", response_model=GenericResponse)
def disconnect() -> GenericResponse:
    ok, msg = engine.disconnect()
    return GenericResponse(success=ok, message=msg, data=engine.get_status())


@router.get("/status")
def status(symbol: str | None = Query(default=None)) -> dict:
    return engine.get_status(symbol=symbol)


@router.get("/history")
def history(
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    lookback_days: int = Query(default=30, ge=1, le=365),
    symbol: str | None = Query(default=None),
    outcome_filter: Literal["all", "win", "loss", "breakeven"] = Query(default="all"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
) -> dict:
    if not engine.mt5.connected:
        raise HTTPException(status_code=400, detail="Connect MT5 first.")
    try:
        return engine.get_trade_history(
            limit=limit,
            offset=offset,
            lookback_days=lookback_days,
            symbol=symbol,
            outcome_filter=outcome_filter,
            date_from=date_from,
            date_to=date_to,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/equity-curve")
def equity_curve(lookback_days: int = Query(default=30, ge=1, le=365)) -> dict:
    if not engine.mt5.connected:
        raise HTTPException(status_code=400, detail="Connect MT5 first.")
    try:
        return engine.get_equity_curve(lookback_days=lookback_days)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/providers", response_model=ProvidersResponse)
def providers() -> ProvidersResponse:
    items = [ProviderInfo(**row) for row in engine.llm.provider_catalog()]
    return ProvidersResponse(providers=items)


@router.post("/positions-insight", response_model=PositionInsightResponse)
def positions_insight(payload: PositionInsightRequest) -> PositionInsightResponse:
    if not engine.mt5.connected:
        raise HTTPException(status_code=400, detail="Connect MT5 first.")
    try:
        result = engine.ask_position_insight(
            provider=payload.provider,
            question=payload.question,
            model=payload.model,
        )
        return PositionInsightResponse(success=True, message="Position insight ready", result=result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/positions-insight-stream")
def positions_insight_stream(
    provider: str = Query(..., description="openai | gemini | sealion"),
    question: str = Query(..., min_length=3, max_length=4000),
    model: str | None = Query(default=None),
) -> StreamingResponse:
    if not engine.mt5.connected:
        raise HTTPException(status_code=400, detail="Connect MT5 first.")

    event_queue: queue.Queue[tuple[str, object]] = queue.Queue()

    def _stream_handler(token: str) -> None:
        event_queue.put(("token", token))

    def _worker() -> None:
        try:
            result = engine.ask_position_insight(
                provider=provider,
                question=question,
                model=model,
                stream_handler=_stream_handler,
            )
            event_queue.put(("done", result))
        except Exception as exc:
            engine.logger.log_exception("positions-insight-stream-failed", exc)
            event_queue.put(("error", str(exc)))

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()

    def _sse_text(event: str, payload: str) -> str:
        lines = payload.splitlines() or [""]
        body = "\n".join(f"data: {line}" for line in lines)
        return f"event: {event}\n{body}\n\n"

    def generate():
        yield _sse_text("status", "Position insight started")
        while True:
            try:
                event_type, payload = event_queue.get(timeout=0.25)
            except queue.Empty:
                if not thread.is_alive():
                    break
                continue

            if event_type == "token":
                yield _sse_text("token", str(payload))
                continue

            if event_type == "error":
                yield _sse_text("error", json.dumps({"error": str(payload)}))
                break

            if event_type == "done":
                yield _sse_text("done", json.dumps(payload, default=str))
                break

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/run-cycle", response_model=RunCycleResponse)
def run_cycle(payload: RunCycleRequest) -> RunCycleResponse:
    if not engine.mt5.connected:
        raise HTTPException(status_code=400, detail="Connect MT5 first.")
    if not engine.run_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Cycle already running")
    try:
        result = engine.run_cycle(
            provider=payload.provider,
            wait_for_new_candle=payload.wait_for_new_candle,
            model=payload.model,
            symbol=payload.symbol,
            trading_mode=payload.trading_mode,
            trading_strategy=payload.trading_strategy,
            user_prompt=payload.user_prompt,
            account_mode=payload.account_mode,
            prop_firm_rules=payload.prop_firm_rules,
            prop_firm_profile_id=payload.prop_firm_profile_id,
        )
        return RunCycleResponse(success=True, message="Cycle complete", result=result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        engine.run_lock.release()


@router.get("/run-cycle-stream")
def run_cycle_stream(
    provider: str = Query(..., description="openai | gemini | sealion"),
    wait_for_new_candle: bool = True,
    model: str | None = Query(default=None),
    symbol: str = Query(default="EURUSDm"),
    trading_mode: TradingMode = Query(default="auto"),
    trading_strategy: TradingStrategy = Query(default="none"),
    user_prompt: str | None = Query(default=None, max_length=1200),
    prop_firm_rules_json: str | None = Query(default=None, max_length=12000),
    account_mode: TradingAccountMode = Query(default="real"),
    prop_firm_profile_id: int | None = Query(default=None, ge=1),
) -> StreamingResponse:
    if not engine.mt5.connected:
        raise HTTPException(status_code=400, detail="Connect MT5 first.")
    if not engine.run_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Cycle already running")
    try:
        selected_provider = engine.llm.resolve_provider(provider)
        selected_model = engine.llm.resolve_model(selected_provider, model)
        selected_symbol = symbol.strip()
        parsed_prop_rules: PropFirmRules | None = None
        if prop_firm_rules_json:
            parsed_prop_rules = PropFirmRules.model_validate(json.loads(prop_firm_rules_json))
    except ValueError as exc:
        engine.run_lock.release()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except json.JSONDecodeError as exc:
        engine.run_lock.release()
        raise HTTPException(status_code=400, detail="Invalid prop_firm_rules_json") from exc

    event_queue: queue.Queue[tuple[str, object]] = queue.Queue()

    def _stream_handler(token: str) -> None:
        event_queue.put(("token", token))

    def _worker() -> None:
        try:
            result = engine.run_cycle(
                provider=selected_provider,
                wait_for_new_candle=wait_for_new_candle,
                model=selected_model,
                symbol=selected_symbol,
                trading_mode=trading_mode,
                trading_strategy=trading_strategy,
                user_prompt=user_prompt,
                account_mode=account_mode,
                prop_firm_rules=parsed_prop_rules,
                prop_firm_profile_id=prop_firm_profile_id,
                stream_handler=_stream_handler,
                force_llm_stream=True,
            )
            event_queue.put(("done", result))
        except Exception as exc:
            engine.logger.log_exception("stream-cycle-failed", exc)
            event_queue.put(("error", str(exc)))
        finally:
            engine.run_lock.release()

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()

    def _sse_text(event: str, payload: str) -> str:
        lines = payload.splitlines() or [""]
        body = "\n".join(f"data: {line}" for line in lines)
        return f"event: {event}\n{body}\n\n"

    def generate():
        yield _sse_text("status", "Cycle started")
        while True:
            try:
                event_type, payload = event_queue.get(timeout=0.25)
            except queue.Empty:
                if not thread.is_alive():
                    break
                continue

            if event_type == "token":
                yield _sse_text("token", str(payload))
                continue

            if event_type == "error":
                yield _sse_text("error", json.dumps({"error": str(payload)}))
                break

            if event_type == "done":
                yield _sse_text("done", json.dumps(payload, default=str))
                break

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
