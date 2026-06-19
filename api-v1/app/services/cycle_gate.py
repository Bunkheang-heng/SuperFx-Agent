from __future__ import annotations

import threading
from threading import Lock


class CycleCancelledError(RuntimeError):
    """Raised when a trading cycle is stopped by the user or client disconnect."""


class CycleRunGate:
    """Single active trading cycle guard (409 when busy) with cooperative cancel."""

    def __init__(self) -> None:
        self._mutex = Lock()
        self._active = False
        self._stop = threading.Event()

    def acquire(self, blocking: bool = True) -> bool:
        if blocking:
            raise NotImplementedError("Only non-blocking acquire is supported")
        with self._mutex:
            if self._active:
                return False
            self._active = True
            self._stop.clear()
            return True

    def release(self) -> None:
        with self._mutex:
            self._active = False
        self._stop.set()

    def cancel(self) -> None:
        """Signal in-flight cycle to stop (safe from SSE disconnect or /cancel)."""
        self._stop.set()

    def is_stop_requested(self) -> bool:
        return self._stop.is_set()

    @property
    def is_active(self) -> bool:
        with self._mutex:
            return self._active
