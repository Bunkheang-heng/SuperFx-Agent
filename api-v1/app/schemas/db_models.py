from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.prop_firm import PropFirmRules


class PropFirmProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    rules: PropFirmRules
    firm_name: str | None = Field(default=None, max_length=120)
    set_active: bool = False


class PropFirmProfileUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    rules: PropFirmRules | None = None
    firm_name: str | None = Field(default=None, max_length=120)
    set_active: bool | None = None


class PropFirmProfileResponse(BaseModel):
    id: int
    name: str
    firm_name: str | None
    rules: PropFirmRules
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PropFirmProfileListResponse(BaseModel):
    profiles: list[PropFirmProfileResponse]
    active_id: int | None = None


class AgentDeskConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    config: dict[str, Any] = Field(default_factory=dict)
    set_active: bool = False


class AgentDeskConfigUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    config: dict[str, Any] | None = None
    set_active: bool | None = None


class AgentDeskConfigResponse(BaseModel):
    id: int
    name: str
    config: dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ComplianceEventResponse(BaseModel):
    rule_key: str
    passed: bool
    message: str
    details: dict[str, Any] | None = None
    created_at: datetime


class AgentMessageResponse(BaseModel):
    role: str
    name: str | None
    provider: str
    model: str
    output: str
    sequence: int


class TradingRunSummary(BaseModel):
    id: int
    run_type: str
    symbol: str
    trading_mode: str
    trading_strategy: str
    provider: str | None
    model: str | None
    prop_firm_profile_id: int | None
    executed: bool
    compliance_passed: bool | None
    compliance_summary: str | None
    created_at: datetime


class TradingRunDetail(TradingRunSummary):
    user_prompt: str | None
    decision: dict[str, Any] | None
    execution: dict[str, Any] | None
    account_snapshot: dict[str, Any] | None
    compliance_events: list[ComplianceEventResponse]
    agent_messages: list[AgentMessageResponse]


class TradingRunListResponse(BaseModel):
    runs: list[TradingRunSummary]
    total: int
    limit: int
    offset: int


def profile_to_response(row) -> PropFirmProfileResponse:
    from app.services.profile_store import rules_from_json

    return PropFirmProfileResponse(
        id=row.id,
        name=row.name,
        firm_name=row.firm_name,
        rules=rules_from_json(row.rules_json),
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def desk_to_response(row) -> AgentDeskConfigResponse:
    return AgentDeskConfigResponse(
        id=row.id,
        name=row.name,
        config=json.loads(row.config_json),
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )
