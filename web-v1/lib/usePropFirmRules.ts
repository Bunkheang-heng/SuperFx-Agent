"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultPropFirmRules,
  loadPropFirmRules,
  PROP_FIRM_UPDATED_EVENT,
  savePropFirmRules,
  type PropFirmRules,
} from "./propFirm";
import {
  getStoredActiveProfileId,
  profilesApi,
  setStoredActiveProfileId,
  type PropFirmProfileRecord,
} from "./profilesApi";

export function usePropFirmRules() {
  const [rules, setRulesState] = useState<PropFirmRules>(defaultPropFirmRules);
  const [hydrated, setHydrated] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<PropFirmProfileRecord[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refreshProfiles = useCallback(async () => {
    try {
      const data = await profilesApi.listPropFirmProfiles();
      setProfiles(data.profiles);
      if (data.active_id) {
        setActiveProfileId(data.active_id);
        setStoredActiveProfileId(data.active_id);
        const active = data.profiles.find((p) => p.id === data.active_id);
        if (active) {
          setRulesState(active.rules);
          savePropFirmRules(active.rules);
        }
      } else {
        setRulesState(loadPropFirmRules());
      }
    } catch {
      setRulesState(loadPropFirmRules());
      setActiveProfileId(getStoredActiveProfileId());
    }
  }, []);

  useEffect(() => {
    void refreshProfiles().finally(() => setHydrated(true));

    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PropFirmRules>).detail;
      if (detail) setRulesState(detail);
    };
    window.addEventListener(PROP_FIRM_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PROP_FIRM_UPDATED_EVENT, onUpdate);
  }, [refreshProfiles]);

  const setRules = useCallback((next: PropFirmRules) => {
    setRulesState(next);
    savePropFirmRules(next);
  }, []);

  const saveToDatabase = useCallback(
    async (profileName: string) => {
      setSyncing(true);
      try {
        const name = profileName.trim() || rules.firm_name?.trim() || "My prop firm profile";
        let profile: PropFirmProfileRecord;
        if (activeProfileId) {
          profile = await profilesApi.updatePropFirmProfile(activeProfileId, {
            name,
            rules,
            firm_name: rules.firm_name ?? undefined,
            set_active: true,
          });
        } else {
          profile = await profilesApi.createPropFirmProfile({
            name,
            rules,
            firm_name: rules.firm_name ?? undefined,
            set_active: true,
          });
        }
        setActiveProfileId(profile.id);
        setStoredActiveProfileId(profile.id);
        await refreshProfiles();
        return profile;
      } finally {
        setSyncing(false);
      }
    },
    [activeProfileId, refreshProfiles, rules],
  );

  const activateProfile = useCallback(
    async (profileId: number) => {
      setSyncing(true);
      try {
        const profile = await profilesApi.activatePropFirmProfile(profileId);
        setActiveProfileId(profile.id);
        setStoredActiveProfileId(profile.id);
        setRules(profile.rules);
        await refreshProfiles();
      } finally {
        setSyncing(false);
      }
    },
    [refreshProfiles, setRules],
  );

  return {
    rules,
    setRules,
    hydrated,
    activeProfileId,
    profiles,
    syncing,
    saveToDatabase,
    activateProfile,
    refreshProfiles,
  };
}
