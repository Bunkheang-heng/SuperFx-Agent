from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.db_models import (
    AgentDeskConfigCreate,
    AgentDeskConfigResponse,
    AgentDeskConfigUpdate,
    PropFirmProfileCreate,
    PropFirmProfileListResponse,
    PropFirmProfileResponse,
    PropFirmProfileUpdate,
    desk_to_response,
    profile_to_response,
)
from app.services.profile_store import ProfileStore

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/prop-firm", response_model=PropFirmProfileListResponse)
def list_prop_firm_profiles(db: Session = Depends(get_db)) -> PropFirmProfileListResponse:
    store = ProfileStore(db)
    rows = store.list_prop_firm_profiles()
    active = store.get_active_prop_firm_profile()
    return PropFirmProfileListResponse(
        profiles=[profile_to_response(r) for r in rows],
        active_id=active.id if active else None,
    )


@router.get("/prop-firm/active", response_model=PropFirmProfileResponse | None)
def get_active_prop_firm_profile(db: Session = Depends(get_db)) -> PropFirmProfileResponse | None:
    store = ProfileStore(db)
    row = store.get_active_prop_firm_profile()
    if row is None:
        return None
    return profile_to_response(row)


@router.get("/prop-firm/{profile_id}", response_model=PropFirmProfileResponse)
def get_prop_firm_profile(profile_id: int, db: Session = Depends(get_db)) -> PropFirmProfileResponse:
    store = ProfileStore(db)
    row = store.get_prop_firm_profile(profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile_to_response(row)


@router.post("/prop-firm", response_model=PropFirmProfileResponse)
def create_prop_firm_profile(
    payload: PropFirmProfileCreate,
    db: Session = Depends(get_db),
) -> PropFirmProfileResponse:
    store = ProfileStore(db)
    row = store.create_prop_firm_profile(
        name=payload.name,
        rules=payload.rules,
        firm_name=payload.firm_name,
        set_active=payload.set_active,
    )
    db.commit()
    return profile_to_response(row)


@router.put("/prop-firm/{profile_id}", response_model=PropFirmProfileResponse)
def update_prop_firm_profile(
    profile_id: int,
    payload: PropFirmProfileUpdate,
    db: Session = Depends(get_db),
) -> PropFirmProfileResponse:
    store = ProfileStore(db)
    row = store.update_prop_firm_profile(
        profile_id,
        name=payload.name,
        rules=payload.rules,
        firm_name=payload.firm_name,
        set_active=payload.set_active,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.commit()
    return profile_to_response(row)


@router.delete("/prop-firm/{profile_id}")
def delete_prop_firm_profile(profile_id: int, db: Session = Depends(get_db)) -> dict:
    store = ProfileStore(db)
    ok = store.delete_prop_firm_profile(profile_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.commit()
    return {"success": True}


@router.post("/prop-firm/{profile_id}/activate", response_model=PropFirmProfileResponse)
def activate_prop_firm_profile(profile_id: int, db: Session = Depends(get_db)) -> PropFirmProfileResponse:
    store = ProfileStore(db)
    row = store.update_prop_firm_profile(profile_id, set_active=True)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.commit()
    return profile_to_response(row)


@router.post("/desk", response_model=AgentDeskConfigResponse)
def create_desk_config(payload: AgentDeskConfigCreate, db: Session = Depends(get_db)) -> AgentDeskConfigResponse:
    store = ProfileStore(db)
    row = store.create_desk_config(name=payload.name, config=payload.config, set_active=payload.set_active)
    db.commit()
    return desk_to_response(row)


@router.get("/desk/{config_id}", response_model=AgentDeskConfigResponse)
def get_desk_config(config_id: int, db: Session = Depends(get_db)) -> AgentDeskConfigResponse:
    store = ProfileStore(db)
    row = store.get_desk_config(config_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Desk config not found")
    return desk_to_response(row)


@router.put("/desk/{config_id}", response_model=AgentDeskConfigResponse)
def update_desk_config(
    config_id: int,
    payload: AgentDeskConfigUpdate,
    db: Session = Depends(get_db),
) -> AgentDeskConfigResponse:
    store = ProfileStore(db)
    row = store.update_desk_config(
        config_id,
        name=payload.name,
        config=payload.config,
        set_active=payload.set_active,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Desk config not found")
    db.commit()
    return desk_to_response(row)
