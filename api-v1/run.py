from __future__ import annotations

import argparse

import uvicorn

from app.core.config import get_settings


def parse_args() -> argparse.Namespace:
    settings = get_settings()
    parser = argparse.ArgumentParser(description="Run the ThinkTrade FastAPI backend.")
    parser.add_argument("--host", default=settings.app_host, help="Bind host (default from .env)")
    parser.add_argument("--port", type=int, default=settings.app_port, help="Bind port (default from .env)")
    parser.add_argument(
        "--reload",
        action="store_true",
        default=settings.app_env.lower() == "development",
        help="Enable auto-reload for development (default on when APP_ENV=development)",
    )
    parser.add_argument(
        "--no-reload",
        action="store_false",
        dest="reload",
        help="Disable auto-reload",
    )
    parser.add_argument("--workers", type=int, default=1, help="Number of worker processes (ignored when --reload)")
    parser.add_argument("--log-level", default="info", choices=["critical", "error", "warning", "info", "debug", "trace"])
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=1 if args.reload else args.workers,
        log_level=args.log_level,
    )


if __name__ == "__main__":
    main()
