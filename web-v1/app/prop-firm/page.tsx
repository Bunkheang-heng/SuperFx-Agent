"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { NavTab, NavTabBar } from "@/components/NavTabs";
import { Badge, Button, Card, Dot, FieldLabel, Input, SectionTitle } from "@/components/ui";
import { PropFirmRulesPanel } from "@/components/PropFirmRulesPanel";
import { useMultiAgentDeskSession } from "@/components/multiAgent/MultiAgentDeskSessionHost";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";
import { usePropFirmRules } from "@/lib/usePropFirmRules";
import {
  applyPropFirmPreset,
  defaultPropFirmRules,
  isPropFirmRulesActive,
  propFirmRulesSummary,
} from "@/lib/propFirm";

type MainTab = "rules" | "desk";

function StepItem({ done, label, hint }: { done: boolean; label: string; hint?: string }) {
  return (
    <li className="flex gap-3">
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
          done
            ? "bg-[var(--success)] text-[#0a101c]"
            : "border border-[var(--border)] bg-[var(--surface-3)] text-[var(--muted)]"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span className="min-w-0">
        <span className={`text-sm ${done ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] text-[var(--muted)]">{hint}</span>}
      </span>
    </li>
  );
}

export default function PropFirmPage() {
  const { onSuccess, onError } = useTradingWorkspace();
  const deskSession = useMultiAgentDeskSession();
  const deskSlotRef = useRef<HTMLDivElement>(null);
  const hiddenDeskSlotRef = useRef<HTMLDivElement>(null);
  const {
    rules,
    setRules,
    hydrated,
    activeProfileId,
    profiles,
    syncing,
    saveToDatabase,
    activateProfile,
  } = usePropFirmRules();
  const [profileName, setProfileName] = useState("My prop firm profile");
  const [mainTab, setMainTab] = useState<MainTab>("rules");

  const rulesReady = isPropFirmRulesActive(rules);
  const hasProfitTarget = rules.profit_target_pct != null && rules.profit_target_pct > 0;
  const hasSavedProfile = activeProfileId != null;

  useEffect(() => {
    deskSession.setPropFirmTab(mainTab === "desk" ? "desk" : "rules");
  }, [mainTab, deskSession]);

  useEffect(() => {
    const visible = mainTab === "desk" ? deskSlotRef.current : hiddenDeskSlotRef.current;
    deskSession.registerPropFirmSlot(visible);
    return () => deskSession.registerPropFirmSlot(null);
  }, [deskSession, mainTab]);

  const goToDesk = () => {
    if (!rulesReady) {
      onError("Enable rules and set a profit target before opening the trading desk.");
      return;
    }
    if (!hasSavedProfile) {
      onError("Save your rules to the database first (step 3 below).");
      return;
    }
    setMainTab("desk");
  };

  const handleReset = () => {
    setRules(defaultPropFirmRules());
    onSuccess("Rules reset to empty draft");
  };

  const handleHolaPrime = () => {
    setRules({ ...applyPropFirmPreset(rules, "holaprime_1step"), enabled: true });
    setProfileName("Hola Prime 1-Step ($2K)");
    onSuccess("Hola Prime $2K template applied");
  };

  const handleSaveDb = async () => {
    if (!rulesReady) {
      onError("Enable rules and fill required limits before saving.");
      return;
    }
    if (!hasProfitTarget) {
      onError("Profit target % is required for the prop firm desk.");
      return;
    }
    try {
      const profile = await saveToDatabase(profileName);
      onSuccess(`Saved profile #${profile.id}`);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const toggleRulesEnabled = () => {
    setRules({ ...rules, enabled: !rules.enabled });
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 sm:px-5">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Prop firm desk</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Set your evaluation rules here, save them once, then run the multi-agent desk with auto-trading. Use a{" "}
          <Link href="/connection" className="text-[var(--accent)] hover:underline">
            Prop firm account type
          </Link>{" "}
          on Connection so compliance matches.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <NavTabBar>
            <NavTab active={mainTab === "rules"} onClick={() => setMainTab("rules")}>
              1. Rules
            </NavTab>
            <NavTab active={mainTab === "desk"} onClick={() => goToDesk()}>
              2. Trading desk
              {deskSession.isLive && mainTab !== "desk" && (
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              )}
            </NavTab>
          </NavTabBar>
          {deskSession.isLive && (
            <Badge tone="accent">
              <Dot tone="accent" pulse />
              Desk running
            </Badge>
          )}
        </div>
      </div>

      {mainTab === "rules" ? (
        <>
          <Card padded={false} className="overflow-hidden">
            <div className="border-b border-[var(--border)] bg-[var(--surface-3)]/50 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <SectionTitle>Setup checklist</SectionTitle>
                  <p className="mt-1 text-xs text-[var(--muted)]">Complete these in order — about 2 minutes.</p>
                </div>
                <Badge tone={rulesReady && hasSavedProfile ? "success" : "default"}>
                  {propFirmRulesSummary(rules)}
                </Badge>
              </div>
              <ol className="mt-4 grid gap-3 sm:grid-cols-2">
                <StepItem done={rules.enabled} label="Turn rules on" />
                <StepItem
                  done={hasProfitTarget}
                  label="Set profit target %"
                  hint="Required under numeric limits"
                />
                <StepItem done={hasSavedProfile} label="Save to database" hint="So the desk loads your profile" />
                <StepItem
                  done={deskSession.isLive}
                  label="Start auto-trading on desk"
                  hint="Tab 2 — configure agents, then Start auto-trading"
                />
              </ol>
            </div>

            <div className="space-y-6 p-5">
              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--foreground)]">Program & limits</h2>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      Pick a template or paste rules from your firm handbook.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rules.enabled}
                      onClick={toggleRulesEnabled}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                        rules.enabled
                          ? "border-[var(--success)] bg-[color-mix(in_oklab,var(--success),transparent_88%)] text-[var(--success)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
                      }`}
                    >
                      Rules {rules.enabled ? "on" : "off"}
                    </button>
                    <Button size="sm" variant="secondary" onClick={handleHolaPrime}>
                      Hola Prime $2K
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleReset}>
                      Reset
                    </Button>
                  </div>
                </div>

                {!rules.enabled ? (
                  <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                    Turn rules <strong className="text-[var(--foreground)]">on</strong> to configure your program.
                  </p>
                ) : hydrated ? (
                  <PropFirmRulesPanel
                    rules={rules}
                    onChange={setRules}
                    embedded
                    showPresets
                    showStructuredByDefault
                  />
                ) : (
                  <p className="text-sm text-[var(--muted)]">Loading saved rules…</p>
                )}
              </section>

              <section className="border-t border-[var(--border)] pt-6">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Save for the desk</h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  The trading desk reads the active saved profile. Profit target % is mandatory.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <FieldLabel>Profile name</FieldLabel>
                    <Input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="e.g. Hola Prime 1-Step $2K"
                    />
                  </div>
                  <Button
                    variant="primary"
                    disabled={syncing || !hydrated || !rules.enabled}
                    onClick={() => void handleSaveDb()}
                  >
                    {syncing ? "Saving…" : "Save rules"}
                  </Button>
                </div>

                {profiles.length > 0 && (
                  <div className="mt-4">
                    <FieldLabel>Saved profiles</FieldLabel>
                    <ul className="mt-2 space-y-1.5">
                      {profiles.map((p) => {
                        const selected = p.id === activeProfileId;
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              disabled={syncing}
                              onClick={() => void activateProfile(p.id).catch((e) => onError((e as Error).message))}
                              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                                selected
                                  ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent),transparent_90%)]"
                                  : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]"
                              }`}
                            >
                              <span className="font-medium text-[var(--foreground)]">{p.name}</span>
                              {selected ? (
                                <Badge tone="success">Active</Badge>
                              ) : (
                                <span className="text-xs text-[var(--muted)]">Use this profile</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <p className="text-sm text-[var(--muted)]">
              {hasSavedProfile
                ? "Rules saved — open the desk to configure agents and start auto-trading."
                : "Save your rules, then continue to the trading desk."}
            </p>
            <Button variant="primary" onClick={goToDesk}>
              Continue to trading desk
            </Button>
          </div>

          <div ref={hiddenDeskSlotRef} className="hidden" aria-hidden />
        </>
      ) : (
        <>
          {!hasSavedProfile && (
            <div className="rounded-xl border border-[var(--warning)]/40 bg-[color-mix(in_oklab,var(--warning),transparent_92%)] px-4 py-3 text-sm text-[var(--foreground)]">
              Save your rules on the <button type="button" className="font-medium text-[var(--accent)] hover:underline" onClick={() => setMainTab("rules")}>Rules</button> tab first.
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--muted)]">
            <strong className="text-[var(--foreground)]">How this tab works:</strong> use{" "}
            <span className="text-[var(--foreground)]">API & agents</span> for keys, configure the{" "}
            <span className="text-[var(--foreground)]">Evaluation session</span> card (symbols from your rules), open{" "}
            <span className="text-[var(--foreground)]">Live evaluation</span> for the war room, and click{" "}
            <span className="text-[var(--foreground)]">Live position</span> to open the position sidebar. Press{" "}
            <span className="text-[var(--foreground)]">Start auto-trading</span> when ready.
          </div>

          <div ref={deskSlotRef} className="min-h-[520px]" />

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setMainTab("rules")}>
              ← Back to rules
            </Button>
            <Link href="/runs" className="inline-flex items-center text-sm font-medium text-[var(--accent)] hover:underline">
              View run history
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
