from __future__ import annotations

import json
import queue
import threading
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.api_models import (
    AgentHealthCheckRequest,
    AgentHealthCheckResponse,
    AutoTradeRequest,
    MonitorRequest,
    MultiAgentRunRequest,
    MultiAgentRunResponse,
    MultiAgentRunResult,
)
from app.services.cycle_gate import CycleCancelledError
from app.services.engine import engine
from app.services.multi_agent import MultiAgentOrchestrator

router = APIRouter(prefix="/api/multi-agent", tags=["multi-agent"])

orchestrator = MultiAgentOrchestrator(engine)


def _sse_text(event: str, payload: Any) -> str:
    if isinstance(payload, str):
        body_text = payload
    else:
        body_text = json.dumps(payload, default=str)
    lines = body_text.splitlines() or [""]
    body = "\n".join(f"data: {line}" for line in lines)
    return f"event: {event}\n{body}\n\n"


@router.post("/run", response_model=MultiAgentRunResponse)
def run(payload: MultiAgentRunRequest) -> MultiAgentRunResponse:
    if not engine.mt5.connected:
        raise HTTPException(status_code=400, detail="Connect MT5 first.")
    if not engine.run_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="A trading cycle is already running.")
    try:
        result = orchestrator.run(
            agents=payload.agents,
            symbol=payload.symbol,
            wait_for_new_candle=payload.wait_for_new_candle,
            trading_mode=payload.trading_mode,
            trading_strategy=payload.trading_strategy,
            user_prompt=payload.user_prompt,
            prop_firm_rules=payload.prop_firm_rules,
            prop_firm_profile_id=payload.prop_firm_profile_id,
            desk_mode=payload.desk_mode,
            account_mode=payload.account_mode,
            execute=payload.execute,
        )
        return MultiAgentRunResponse(
            success=True,
            message="Multi-agent cycle complete",
            result=MultiAgentRunResult(**result),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        engine.run_lock.release()


@router.post("/cancel")
def cancel_cycle() -> dict[str, str]:
    """Ask the active cycle to stop and release the run lock when the worker exits."""
    engine.run_lock.cancel()
    return {"ok": True, "message": "Cancel requested"}


@router.post("/run-stream")
def run_stream(payload: MultiAgentRunRequest) -> StreamingResponse:
    if not engine.mt5.connected:
        raise HTTPException(status_code=400, detail="Connect MT5 first.")
    if not engine.run_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="A trading cycle is already running.")

    event_queue: queue.Queue[tuple[str, Any]] = queue.Queue()
    stop_flag = engine.run_lock.is_stop_requested

    def _on_event(event_type: str, data: Any) -> None:
        event_queue.put((event_type, data))

    def _worker() -> None:
        try:
            orchestrator.run(
                agents=payload.agents,
                symbol=payload.symbol,
                wait_for_new_candle=payload.wait_for_new_candle,
                trading_mode=payload.trading_mode,
                trading_strategy=payload.trading_strategy,
                user_prompt=payload.user_prompt,
                prop_firm_rules=payload.prop_firm_rules,
                prop_firm_profile_id=payload.prop_firm_profile_id,
                desk_mode=payload.desk_mode,
                account_mode=payload.account_mode,
                execute=payload.execute,
                event_handler=_on_event,
                stop_flag=stop_flag,
            )
        except CycleCancelledError:
            event_queue.put(("cancelled", {"message": "Cycle stopped"}))
        except Exception as exc:
            engine.logger.log_exception("multi-agent-stream-failed", exc)
            event_queue.put(("error", {"error": str(exc)}))
        finally:
            event_queue.put(("__end__", None))
            engine.run_lock.release()

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()

    def generate():
        yield _sse_text("status", {"message": "Multi-agent cycle started"})
        try:
            while True:
                try:
                    event_type, data = event_queue.get(timeout=0.25)
                except queue.Empty:
                    if not thread.is_alive():
                        break
                    continue
                if event_type == "__end__":
                    break
                yield _sse_text(event_type, data)
                if event_type in {"done", "error", "cancelled"}:
                    break
        finally:
            engine.run_lock.cancel()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/monitor-stream")
def monitor_stream(payload: MonitorRequest) -> StreamingResponse:
    if not engine.mt5.connected:
        raise HTTPException(status_code=400, detail="Connect MT5 first.")

    event_queue: queue.Queue[tuple[str, Any]] = queue.Queue()
    stop_event = threading.Event()

    def _on_event(event_type: str, data: Any) -> None:
        event_queue.put((event_type, data))

    def _stop_flag() -> bool:
        return stop_event.is_set()

    def _worker() -> None:
        try:
            orchestrator.run_monitor_loop(
                agents=payload.agents,
                symbol=payload.symbol,
                trading_mode=payload.trading_mode,
                trading_strategy=payload.trading_strategy,
                user_prompt=payload.user_prompt,
                prop_firm_rules=payload.prop_firm_rules,
                prop_firm_profile_id=payload.prop_firm_profile_id,
                account_mode=payload.account_mode,
                desk_mode=payload.desk_mode,
                interval_seconds=payload.interval_seconds,
                max_iterations=payload.max_iterations,
                execute=payload.execute,
                event_handler=_on_event,
                stop_flag=_stop_flag,
            )
        except Exception as exc:
            engine.logger.log_exception("multi-agent-monitor-stream-failed", exc)
            event_queue.put(("error", {"error": str(exc)}))
        finally:
            event_queue.put(("__end__", None))

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()

    def generate():
        yield _sse_text(
            "status",
            {"message": f"Monitoring started for {payload.symbol}"},
        )
        try:
            while True:
                try:
                    event_type, data = event_queue.get(timeout=0.5)
                except queue.Empty:
                    if not thread.is_alive():
                        break
                    yield ": keep-alive\n\n"
                    continue
                if event_type == "__end__":
                    break
                yield _sse_text(event_type, data)
                if event_type == "monitor_done":
                    break
        finally:
            stop_event.set()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/auto-trade-stream")
def auto_trade_stream(payload: AutoTradeRequest) -> StreamingResponse:
    if not engine.mt5.connected:
        raise HTTPException(status_code=400, detail="Connect MT5 first.")
    if not engine.run_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="A trading cycle is already running.")

    event_queue: queue.Queue[tuple[str, Any]] = queue.Queue()
    stop_flag = engine.run_lock.is_stop_requested

    def _on_event(event_type: str, data: Any) -> None:
        event_queue.put((event_type, data))

    def _worker() -> None:
        try:
            orchestrator.run_auto_trade_loop(
                agents=payload.agents,
                symbol=payload.symbol,
                wait_for_new_candle=payload.wait_for_new_candle,
                trading_mode=payload.trading_mode,
                trading_strategy=payload.trading_strategy,
                user_prompt=payload.user_prompt,
                prop_firm_rules=payload.prop_firm_rules,
                prop_firm_profile_id=payload.prop_firm_profile_id,
                desk_mode=payload.desk_mode,
                account_mode=payload.account_mode,
                execute=payload.execute,
                entry_interval_seconds=payload.entry_interval_seconds,
                monitor_interval_seconds=payload.monitor_interval_seconds,
                monitor_max_iterations=payload.monitor_max_iterations,
                event_handler=_on_event,
                stop_flag=stop_flag,
            )
        except CycleCancelledError:
            event_queue.put(("cancelled", {"message": "Auto-trading stopped"}))
        except Exception as exc:
            engine.logger.log_exception("auto-trade-stream-failed", exc)
            event_queue.put(("error", {"error": str(exc), "recoverable": False}))
        finally:
            event_queue.put(("__end__", None))
            engine.run_lock.release()

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()

    def generate():
        yield _sse_text(
            "status",
            {"message": f"Auto-trading started on {payload.symbol} (stop via disconnect or Stop button)"},
        )
        try:
            while True:
                try:
                    event_type, data = event_queue.get(timeout=0.5)
                except queue.Empty:
                    if not thread.is_alive():
                        break
                    yield ": keep-alive\n\n"
                    continue
                if event_type == "__end__":
                    break
                yield _sse_text(event_type, data)
                if event_type in {"auto_trade_done", "error", "cancelled"}:
                    break
        finally:
            engine.run_lock.cancel()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/health-check", response_model=AgentHealthCheckResponse)
def health_check(payload: AgentHealthCheckRequest) -> AgentHealthCheckResponse:
    try:
        sample = engine.llm.complete_with_credentials(
            provider=payload.provider,
            api_key=payload.api_key,
            model=payload.model,
            base_url=payload.base_url,
            prompt="Reply with the single word: PONG",
            system_prompt="You are a connectivity probe. Respond with exactly one short word.",
            max_tokens=20,
            temperature=0.0,
        )
        return AgentHealthCheckResponse(
            success=True,
            provider=payload.provider,
            model=payload.model,
            sample=(sample or "").strip()[:200],
        )
    except Exception as exc:
        return AgentHealthCheckResponse(
            success=False,
            provider=payload.provider,
            model=payload.model,
            error=str(exc),
        )
