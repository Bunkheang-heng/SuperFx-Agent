from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.db_models import (
    AgentMessageResponse,
    ComplianceEventResponse,
    TradingRunDetail,
    TradingRunListResponse,
    TradingRunSummary,
)
from app.services.run_recorder import RunRecorder

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("", response_model=TradingRunListResponse)
def list_runs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    symbol: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> TradingRunListResponse:
    recorder = RunRecorder(db)
    rows = recorder.list_runs(limit=limit, offset=offset, symbol=symbol)
    total = recorder.count_runs(symbol=symbol)
    return TradingRunListResponse(
        runs=[_run_summary(r) for r in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{run_id}", response_model=TradingRunDetail)
def get_run(run_id: int, db: Session = Depends(get_db)) -> TradingRunDetail:
    recorder = RunRecorder(db)
    row = recorder.get_run(run_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Run not found")

    account_snapshot = None
    if row.account_snapshots:
        snap = row.account_snapshots[0]
        account_snapshot = {
            "balance": snap.balance,
            "equity": snap.equity,
            "margin_free": snap.margin_free,
            "profit": snap.profit,
            "leverage": snap.leverage,
            "payload": json.loads(snap.snapshot_json),
        }

    return TradingRunDetail(
        **_run_summary(row).model_dump(),
        user_prompt=row.user_prompt,
        decision=json.loads(row.decision_json) if row.decision_json else None,
        execution=json.loads(row.execution_json) if row.execution_json else None,
        account_snapshot=account_snapshot,
        compliance_events=[
            ComplianceEventResponse(
                rule_key=e.rule_key,
                passed=e.passed,
                message=e.message,
                details=json.loads(e.details_json) if e.details_json else None,
                created_at=e.created_at,
            )
            for e in row.compliance_events
        ],
        agent_messages=[
            AgentMessageResponse(
                role=m.role,
                name=m.name,
                provider=m.provider,
                model=m.model,
                output=m.output,
                sequence=m.sequence,
            )
            for m in sorted(row.agent_messages, key=lambda x: x.sequence)
        ],
    )


def _run_summary(row) -> TradingRunSummary:
    return TradingRunSummary(
        id=row.id,
        run_type=row.run_type,
        symbol=row.symbol,
        trading_mode=row.trading_mode,
        trading_strategy=row.trading_strategy,
        provider=row.provider,
        model=row.model,
        prop_firm_profile_id=row.prop_firm_profile_id,
        executed=row.executed,
        compliance_passed=row.compliance_passed,
        compliance_summary=row.compliance_summary,
        created_at=row.created_at,
    )
