"use client";

import { useState } from "react";
import { Badge, FieldLabel, Input } from "@/components/ui";
import {
  applyPropFirmPreset,
  PROP_FIRM_PRESETS,
  type PropFirmPresetId,
  type PropFirmRules,
} from "@/lib/propFirm";

type Props = {
  rules: PropFirmRules;
  onChange: (rules: PropFirmRules) => void;
  className?: string;
  showPresets?: boolean;
  showStructuredByDefault?: boolean;
  /** Hide panel header when the parent page provides context */
  embedded?: boolean;
};

function NumField({
  label,
  value,
  onChange,
  placeholder,
  max,
  step = "0.1",
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder: string;
  max?: number;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="number"
        min={0}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value.trim();
          onChange(raw === "" ? null : Number(raw));
        }}
        placeholder={placeholder}
        className="font-mono"
      />
    </div>
  );
}

function TriStateToggle({
  label,
  value,
  onChange,
  trueLabel = "Allowed",
  falseLabel = "Forbidden",
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (v: boolean | null) => void;
  trueLabel?: string;
  falseLabel?: string;
}) {
  const options: { id: boolean | null; label: string }[] = [
    { id: null, label: "Not set" },
    { id: true, label: trueLabel },
    { id: false, label: falseLabel },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.id || (value === undefined && opt.id === null);
          return (
            <button
              key={String(opt.id)}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "pill-active"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PropFirmRulesPanel({
  rules,
  onChange,
  className = "",
  showPresets = false,
  showStructuredByDefault = false,
  embedded = false,
}: Props) {
  const [showStructured, setShowStructured] = useState(showStructuredByDefault);

  const patch = (partial: Partial<PropFirmRules>) => onChange({ ...rules, ...partial });

  const applyPreset = (presetId: PropFirmPresetId) => {
    onChange(applyPropFirmPreset(rules, presetId));
    if (presetId !== "custom") setShowStructured(true);
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {!embedded && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-medium text-[var(--foreground)]">Prop firm rules</div>
              {rules.enabled && (
                <Badge tone="success">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                  Active
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
              Paste your funded-account rules here. All agents receive them; risk manager and team lead must
              enforce them before approving trades.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={rules.enabled}
            onClick={() => patch({ enabled: !rules.enabled })}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
              rules.enabled
                ? "pill-active"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
            }`}
          >
            {rules.enabled ? "On" : "Off"}
          </button>
        </div>
      )}

      {rules.enabled && (
        <>
          {showPresets && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Firm template</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROP_FIRM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-left transition hover:border-[var(--accent)] hover:bg-[color-mix(in_oklab,var(--accent),transparent_92%)]"
                  >
                    <div className="text-sm font-medium text-[var(--foreground)]">{preset.label}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Firm / program name (optional)</FieldLabel>
            <Input
              value={rules.firm_name ?? ""}
              onChange={(e) => patch({ firm_name: e.target.value })}
              placeholder="e.g. FTMO, FundedNext, The5ers"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel>Firm rules for the AI (paste from handbook)</FieldLabel>
            <textarea
              value={rules.custom_rules ?? ""}
              onChange={(e) => patch({ custom_rules: e.target.value })}
              maxLength={8000}
              placeholder={
                "Example:\n- Max daily loss 5% of initial balance\n- Max overall drawdown 10%\n- No trading 2 min before/after high-impact news\n- Minimum 4 trading days\n- Best day profit cannot exceed 40% of total profit\n- No hedging, no EA unless allowed"
              }
              className="min-h-[120px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent),transparent_72%)]"
            />
            <div className="flex justify-end text-[11px] text-[var(--muted)]">
              {(rules.custom_rules ?? "").length}/8000
            </div>
          </div>

          {!showStructuredByDefault && (
            <button
              type="button"
              onClick={() => setShowStructured((v) => !v)}
              className="text-left text-xs font-medium text-[var(--accent)] hover:underline"
            >
              {showStructured ? "Hide numeric limits" : "Show numeric limits (daily loss, drawdown, lots…)"}
            </button>
          )}

          {showStructured && (
            <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 sm:grid-cols-2">
              <NumField
                label="Max daily loss %"
                value={rules.max_daily_loss_pct}
                onChange={(v) => patch({ max_daily_loss_pct: v })}
                placeholder="5"
                max={100}
              />
              <NumField
                label="Max drawdown %"
                value={rules.max_drawdown_pct}
                onChange={(v) => patch({ max_drawdown_pct: v })}
                placeholder="10"
                max={100}
              />
              <NumField
                label="Profit target %"
                value={rules.profit_target_pct}
                onChange={(v) => patch({ profit_target_pct: v })}
                placeholder="10"
              />
              <NumField
                label="Account size ($)"
                value={rules.account_size}
                onChange={(v) => patch({ account_size: v })}
                placeholder="2000"
                step="100"
                max={100_000_000}
              />
              <NumField
                label="Max risk per trade %"
                value={rules.max_risk_per_trade_pct}
                onChange={(v) => patch({ max_risk_per_trade_pct: v })}
                placeholder="2"
                max={100}
              />
              <div className="sm:col-span-2">
                <TriStateToggle
                  label="Stop loss requirement"
                  trueLabel="Required"
                  falseLabel="Optional"
                  value={
                    rules.require_stop_loss === true
                      ? true
                      : rules.require_stop_loss === false
                        ? false
                        : null
                  }
                  onChange={(v) => patch({ require_stop_loss: v })}
                />
              </div>
              <NumField
                label="Max lot per trade"
                value={rules.max_lot}
                onChange={(v) => patch({ max_lot: v })}
                placeholder="2"
                step="0.01"
              />
              <NumField
                label="Max trades per day"
                value={rules.max_trades_per_day}
                onChange={(v) => patch({ max_trades_per_day: v })}
                placeholder="3"
                step="1"
              />
              <NumField
                label="Max open positions"
                value={rules.max_open_positions}
                onChange={(v) => patch({ max_open_positions: v })}
                placeholder="1"
                step="1"
              />
              <NumField
                label="Min trading days"
                value={rules.min_trading_days}
                onChange={(v) => patch({ min_trading_days: v })}
                placeholder="4"
                step="1"
              />
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <FieldLabel>Allowed symbols (comma-separated)</FieldLabel>
                <Input
                  value={rules.allowed_symbols ?? ""}
                  onChange={(e) => patch({ allowed_symbols: e.target.value })}
                  placeholder="XAUUSDm, EURUSDm"
                  className="font-mono uppercase"
                />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <FieldLabel>Forbidden symbols</FieldLabel>
                <Input
                  value={rules.forbidden_symbols ?? ""}
                  onChange={(e) => patch({ forbidden_symbols: e.target.value })}
                  placeholder="BTCUSDm"
                  className="font-mono uppercase"
                />
              </div>
              <TriStateToggle
                label="News trading"
                value={rules.news_trading_allowed}
                onChange={(v) => patch({ news_trading_allowed: v })}
              />
              <TriStateToggle
                label="Weekend / overnight holding"
                value={rules.weekend_holding_allowed}
                onChange={(v) => patch({ weekend_holding_allowed: v })}
              />
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <FieldLabel>Consistency rule (optional)</FieldLabel>
                <textarea
                  value={rules.consistency_rule ?? ""}
                  onChange={(e) => patch({ consistency_rule: e.target.value })}
                  maxLength={2000}
                  placeholder="e.g. Best single day cannot exceed 30% of total profit."
                  className="min-h-[64px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
