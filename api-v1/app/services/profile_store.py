from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AgentDeskConfig, PropFirmProfile
from app.schemas.prop_firm import PropFirmRules


def rules_to_json(rules: PropFirmRules) -> str:
    return rules.model_dump_json()


def rules_from_json(raw: str) -> PropFirmRules:
    return PropFirmRules.model_validate_json(raw)


class ProfileStore:
  def __init__(self, db: Session) -> None:
    self.db = db

  def list_prop_firm_profiles(self) -> list[PropFirmProfile]:
    return list(self.db.scalars(select(PropFirmProfile).order_by(PropFirmProfile.updated_at.desc())))

  def get_prop_firm_profile(self, profile_id: int) -> PropFirmProfile | None:
    return self.db.get(PropFirmProfile, profile_id)

  def get_active_prop_firm_profile(self) -> PropFirmProfile | None:
    return self.db.scalar(select(PropFirmProfile).where(PropFirmProfile.is_active.is_(True)).limit(1))

  def get_active_rules(self) -> PropFirmRules | None:
    profile = self.get_active_prop_firm_profile()
    if profile is None:
      return None
    rules = rules_from_json(profile.rules_json)
    if not rules.enabled:
      return None
    return rules

  def create_prop_firm_profile(
    self,
    *,
    name: str,
    rules: PropFirmRules,
    firm_name: str | None = None,
    set_active: bool = False,
  ) -> PropFirmProfile:
    if set_active:
      self._clear_active_prop_firm()
    profile = PropFirmProfile(
      name=name.strip(),
      firm_name=(firm_name or rules.firm_name or "").strip() or None,
      rules_json=rules_to_json(rules),
      is_active=set_active,
    )
    self.db.add(profile)
    self.db.flush()
    return profile

  def update_prop_firm_profile(
    self,
    profile_id: int,
    *,
    name: str | None = None,
    rules: PropFirmRules | None = None,
    firm_name: str | None = None,
    set_active: bool | None = None,
  ) -> PropFirmProfile | None:
    profile = self.get_prop_firm_profile(profile_id)
    if profile is None:
      return None
    if name is not None:
      profile.name = name.strip()
    if rules is not None:
      profile.rules_json = rules_to_json(rules)
      if firm_name is not None:
        profile.firm_name = firm_name.strip() or None
      elif rules.firm_name:
        profile.firm_name = rules.firm_name.strip() or None
    if set_active is True:
      self._clear_active_prop_firm()
      profile.is_active = True
    elif set_active is False:
      profile.is_active = False
    self.db.flush()
    return profile

  def delete_prop_firm_profile(self, profile_id: int) -> bool:
    profile = self.get_prop_firm_profile(profile_id)
    if profile is None:
      return False
    self.db.delete(profile)
    self.db.flush()
    return True

  def _clear_active_prop_firm(self) -> None:
    for row in self.db.scalars(select(PropFirmProfile).where(PropFirmProfile.is_active.is_(True))):
      row.is_active = False

  def list_desk_configs(self) -> list[AgentDeskConfig]:
    return list(self.db.scalars(select(AgentDeskConfig).order_by(AgentDeskConfig.updated_at.desc())))

  def get_desk_config(self, config_id: int) -> AgentDeskConfig | None:
    return self.db.get(AgentDeskConfig, config_id)

  def create_desk_config(self, *, name: str, config: dict[str, Any], set_active: bool = False) -> AgentDeskConfig:
    if set_active:
      self._clear_active_desk()
    row = AgentDeskConfig(name=name.strip(), config_json=json.dumps(config, default=str), is_active=set_active)
    self.db.add(row)
    self.db.flush()
    return row

  def update_desk_config(
    self,
    config_id: int,
    *,
    name: str | None = None,
    config: dict[str, Any] | None = None,
    set_active: bool | None = None,
  ) -> AgentDeskConfig | None:
    row = self.get_desk_config(config_id)
    if row is None:
      return None
    if name is not None:
      row.name = name.strip()
    if config is not None:
      row.config_json = json.dumps(config, default=str)
    if set_active is True:
      self._clear_active_desk()
      row.is_active = True
    elif set_active is False:
      row.is_active = False
    self.db.flush()
    return row

  def delete_desk_config(self, config_id: int) -> bool:
    row = self.get_desk_config(config_id)
    if row is None:
      return False
    self.db.delete(row)
    self.db.flush()
    return True

  def _clear_active_desk(self) -> None:
    for row in self.db.scalars(select(AgentDeskConfig).where(AgentDeskConfig.is_active.is_(True))):
      row.is_active = False


def resolve_prop_firm_rules(
  db: Session,
  *,
  inline_rules: PropFirmRules | None,
  profile_id: int | None,
  use_active_profile: bool = True,
) -> tuple[PropFirmRules | None, int | None]:
  """Resolve rules: inline body > profile_id > active DB profile."""
  if inline_rules is not None and inline_rules.enabled:
    return inline_rules, profile_id

  store = ProfileStore(db)
  if profile_id is not None:
    profile = store.get_prop_firm_profile(profile_id)
    if profile is not None:
      rules = rules_from_json(profile.rules_json)
      if rules.enabled:
        return rules, profile.id
  if use_active_profile:
    profile = store.get_active_prop_firm_profile()
    if profile is not None:
      rules = rules_from_json(profile.rules_json)
      if rules.enabled:
        return rules, profile.id
  if inline_rules is not None and not inline_rules.enabled:
    return None, profile_id
  return inline_rules if inline_rules and inline_rules.enabled else None, profile_id
