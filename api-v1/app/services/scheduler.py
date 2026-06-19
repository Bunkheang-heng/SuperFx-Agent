from __future__ import annotations

import time
from collections import defaultdict
from collections.abc import Callable


class CandleScheduler:
    def __init__(self, poll_interval_seconds: int) -> None:
        self.poll_interval_seconds = poll_interval_seconds
        self._last_processed_candle_time: dict[tuple[str, str], int | None] = defaultdict(lambda: None)

    def wait_for_new_closed_candle(
        self,
        key: tuple[str, str],
        get_last_closed_candle_time: Callable[[], int],
        stop_flag: Callable[[], bool] | None = None,
    ) -> int:
        while True:
            if stop_flag is not None and stop_flag():
                from app.services.cycle_gate import CycleCancelledError

                raise CycleCancelledError("Cycle cancelled")
            closed_time = get_last_closed_candle_time()
            last_time = self._last_processed_candle_time[key]
            if last_time is None:
                self._last_processed_candle_time[key] = closed_time
                return closed_time
            if closed_time > last_time:
                self._last_processed_candle_time[key] = closed_time
                return closed_time
            time.sleep(self.poll_interval_seconds)
