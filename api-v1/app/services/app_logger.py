import json
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.core.config import get_settings


class AppLogger:
    def __init__(self) -> None:
        settings = get_settings()
        self.log_dir = Path(settings.log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.snapshots_file = self.log_dir / "snapshots.log"
        self.decisions_file = self.log_dir / "decisions.log"
        self.orders_file = self.log_dir / "orders.log"
        self.errors_file = self.log_dir / "errors.log"

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _write_jsonl(self, file_path: Path, payload: dict[str, Any]) -> None:
        with file_path.open("a", encoding="utf-8") as file:
            file.write(json.dumps(payload, default=str, ensure_ascii=True) + "\n")

    def log_snapshot(self, payload: dict[str, Any]) -> None:
        self._write_jsonl(self.snapshots_file, {"timestamp": self._now(), "snapshot": payload})

    def log_decision(self, payload: dict[str, Any]) -> None:
        self._write_jsonl(self.decisions_file, {"timestamp": self._now(), **payload})

    def log_order(self, payload: dict[str, Any]) -> None:
        self._write_jsonl(self.orders_file, {"timestamp": self._now(), **payload})

    def log_exception(self, context: str, exc: Exception) -> None:
        self._write_jsonl(
            self.errors_file,
            {
                "timestamp": self._now(),
                "context": context,
                "error": str(exc),
                "traceback": traceback.format_exc(),
            },
        )

    def info(self, category: str, message: str, **extra: object) -> None:
        self._write_jsonl(self._category_file(category), {"timestamp": self._now(), "level": "info", "message": message, "extra": extra})

    def error(self, category: str, message: str, **extra: object) -> None:
        self._write_jsonl(self._category_file(category), {"timestamp": self._now(), "level": "error", "message": message, "extra": extra})

    def _category_file(self, category: str) -> Path:
        mapping = {
            "snapshots": self.snapshots_file,
            "decisions": self.decisions_file,
            "orders": self.orders_file,
            "errors": self.errors_file,
        }
        return mapping.get(category, self.log_dir / f"{category}.log")

    def recent(self, category: str, limit: int = 100) -> list[dict]:
        file_path = self._category_file(category)
        if not file_path.exists():
            return []
        lines = file_path.read_text(encoding="utf-8").splitlines()
        out: list[dict] = []
        for line in lines[-limit:]:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return out

    def all_recent(self, limit: int = 50) -> dict[str, list[dict]]:
        categories = ["snapshots", "decisions", "orders", "errors"]
        return {c: self.recent(c, limit) for c in categories}
