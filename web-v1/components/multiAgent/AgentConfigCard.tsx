"use client";

import { useState } from "react";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";
import {
  AGENT_ROLES,
  PROVIDER_OPTIONS,
  findProviderOption,
  type AgentConfig,
  type AgentProvider,
  checkAgentHealth,
} from "@/lib/multiAgent";

export function AgentConfigCard({
  agent,
  onChange,
  onInfo,
  onError,
}: {
  agent: AgentConfig;
  onChange: (next: AgentConfig) => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}) {
  const role = AGENT_ROLES.find((r) => r.id === agent.role) ?? AGENT_ROLES[0];
  const providerMeta =
    PROVIDER_OPTIONS.find((p) => p.id === agent.provider) ?? PROVIDER_OPTIONS[0];
  const [revealKey, setRevealKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<{ ok: boolean; message: string } | null>(null);

  const update = (patch: Partial<AgentConfig>) => onChange({ ...agent, ...patch });

  const handleProviderChange = (next: AgentProvider) => {
    const meta = findProviderOption(next);
    const presetIds = meta.models.map((m) => m.id);
    const keepCurrent =
      presetIds.includes(agent.model) || (meta.allowCustomModel && agent.model.trim() !== "");
    const nextModel = keepCurrent ? agent.model : meta.defaultModel ?? meta.models[0]?.id ?? "";
    update({
      provider: next,
      base_url: meta.defaultBaseUrl ?? "",
      model: nextModel,
    });
  };

  const knownModelIds = providerMeta.models.map((m) => m.id);
  const isCustomModel =
    agent.model.trim() !== "" && !knownModelIds.includes(agent.model.trim());
  const showCustomInput = providerMeta.models.length === 0 || isCustomModel;

  const handleHealthCheck = async () => {
    if (!agent.api_key.trim()) {
      onError(`${role.label}: API key is required to test the connection.`);
      return;
    }
    if (!agent.model.trim()) {
      onError(`${role.label}: Model id is required to test the connection.`);
      return;
    }
    setChecking(true);
    setLastCheck(null);
    try {
      const result = await checkAgentHealth(agent);
      if (result.success) {
        setLastCheck({ ok: true, message: result.sample?.trim() || "OK" });
        onInfo(`${role.label} connection OK`);
      } else {
        setLastCheck({ ok: false, message: result.error || "unknown error" });
        onError(`${role.label} health check failed: ${result.error || "unknown error"}`);
      }
    } catch (err) {
      const msg = (err as Error).message;
      setLastCheck({ ok: false, message: msg });
      onError(`${role.label} health check failed: ${msg}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card
      title={role.label}
      subtitle={role.description}
      icon={
        <span
          className={`grid h-7 w-7 place-items-center rounded-md ${role.iconBg} text-xs font-bold text-white`}
        >
          {role.icon}
        </span>
      }
      action={
        <Badge tone={agent.api_key.trim() ? "success" : "warning"}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              agent.api_key.trim() ? "bg-[var(--success)]" : "bg-[var(--warning)]"
            }`}
          />
          {agent.api_key.trim() ? "Key set" : "Key missing"}
        </Badge>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Display name</FieldLabel>
          <Input
            value={agent.name ?? ""}
            onChange={(e) => update({ name: e.target.value })}
            placeholder={role.label}
            maxLength={80}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Provider</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {PROVIDER_OPTIONS.map((option) => {
              const active = agent.provider === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleProviderChange(option.id)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    active
                      ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent),transparent_88%)] shadow-[0_0_0_1px_var(--accent)_inset]"
                      : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
                  }`}
                >
                  <div className="text-sm font-medium text-[var(--foreground)]">{option.label}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{option.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Model</FieldLabel>
          {providerMeta.models.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <select
                  value={isCustomModel ? "__custom__" : agent.model}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (next === "__custom__") {
                      update({ model: "" });
                    } else {
                      update({ model: next });
                    }
                  }}
                  className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 pr-9 text-sm text-[var(--foreground)] outline-none transition hover:border-[var(--border-strong)] focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/25"
                >
                  {providerMeta.models.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                      {option.hint ? ` — ${option.hint}` : ""}
                    </option>
                  ))}
                  {providerMeta.allowCustomModel && (
                    <option value="__custom__">Custom model id...</option>
                  )}
                </select>
                <svg
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {showCustomInput && (
                <Input
                  value={agent.model}
                  onChange={(e) => update({ model: e.target.value })}
                  placeholder={providerMeta.defaultModel ?? "Enter custom model id"}
                  className="font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
              )}
            </div>
          ) : (
            <Input
              value={agent.model}
              onChange={(e) => update({ model: e.target.value })}
              placeholder={providerMeta.defaultModel ?? "e.g. llama-3.1-70b-versatile"}
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
            />
          )}
          <p className="text-[11px] text-[var(--muted)]">
            {providerMeta.models.length > 0
              ? `Curated models for ${providerMeta.label}. Pick "Custom..." to type any model id supported by your account.`
              : `Enter the model id exposed by your ${providerMeta.label} endpoint.`}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>API key</FieldLabel>
          <div className="flex gap-2">
            <Input
              type={revealKey ? "text" : "password"}
              value={agent.api_key}
              onChange={(e) => update({ api_key: e.target.value })}
              placeholder="sk-..."
              className="font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <Button variant="ghost" size="sm" onClick={() => setRevealKey((v) => !v)}>
              {revealKey ? "Hide" : "Show"}
            </Button>
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Sent per request, never stored on the server. Saved locally in your browser only.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="self-start text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          {showAdvanced ? "Hide" : "Show"} advanced options
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Base URL (optional)</FieldLabel>
              <Input
                value={agent.base_url ?? ""}
                onChange={(e) => update({ base_url: e.target.value })}
                placeholder={providerMeta.defaultBaseUrl ?? "Leave empty to use provider default"}
                className="font-mono"
                disabled={!providerMeta.baseUrlEditable}
              />
              <p className="text-[11px] text-[var(--muted)]">
                For OpenAI-compatible endpoints (Groq, Together, custom proxy, etc).
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Temperature</FieldLabel>
              <Input
                type="number"
                step="0.1"
                min={0}
                max={2}
                value={agent.temperature ?? 0.1}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  update({ temperature: Number.isFinite(v) ? v : 0.1 });
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Agent skills (optional)</FieldLabel>
              <textarea
                value={agent.skills ?? ""}
                onChange={(e) => update({ skills: e.target.value })}
                placeholder="Bullet playbook: tone, checklists, instruments you use, things to always mention..."
                className="min-h-[100px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent),transparent_72%)]"
                maxLength={6000}
              />
              <p className="text-[11px] text-[var(--muted)]">
                Appended after the built-in role prompt (or after your system override). Use for desk standards,
                methodology, or formatting habits without replacing the whole role.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>System prompt override (optional)</FieldLabel>
              <textarea
                value={agent.system_prompt ?? ""}
                onChange={(e) => update({ system_prompt: e.target.value })}
                placeholder="Leave empty to use the built-in role prompt."
                className="min-h-[110px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-mono text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent),transparent_72%)]"
                maxLength={8000}
              />
              <p className="text-[11px] text-[var(--muted)]">
                Replaces the default role prompt entirely when set. Team Lead must still end with FINAL_DECISION_JSON
                (new entries) or MONITOR_DECISION_JSON (open position monitor).
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" loading={checking} onClick={handleHealthCheck}>
            Test connection
          </Button>
          {lastCheck && (
            <span
              className={`truncate font-mono text-[11px] ${
                lastCheck.ok ? "text-[var(--success)]" : "text-[var(--danger)]"
              }`}
              title={lastCheck.message}
            >
              {lastCheck.ok ? `OK · ${lastCheck.message}` : `Error · ${lastCheck.message}`}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
