from fastapi import APIRouter, Query
from app.services.engine import engine

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("/recent")
def recent(category: str = Query(default="snapshots"), limit: int = Query(default=100, ge=1, le=1000)) -> dict:
    return {"category": category, "items": engine.logger.recent(category, limit)}


@router.get("/all-recent")
def all_recent(limit: int = Query(default=50, ge=1, le=1000)) -> dict:
    return engine.logger.all_recent(limit)
