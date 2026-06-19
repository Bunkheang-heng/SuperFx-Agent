"use client";

import { Badge, Button, Card, FieldLabel } from "@/components/ui";
import type { DeskTradeSetupProps } from "@/components/multiAgent/deskSetupTypes";
import {
  PROP_FIRM_ENTRY_INTERVAL_OPTIONS,
  PROP_FIRM_MONITOR_INTERVAL_OPTIONS,
  STRATEGY_OPTIONS,
  TRADING_MODE_OPTIONS,
} from "@/components/multiAgent/deskSetupConstants";
import { isPropFirmRulesActive, propFirmRulesSummary, type PropFirmRules } from "@/lib/propFirm";

type PropFirmDeskTradeSetupProps = DeskTradeSetupProps & {
  propFirmRules: PropFirmRules;
  activeProfileId: number | null;
  symbolOptions: string[];
  useRuleSymbols: boolean;
  rulesReady: boolean;
  onEditRules?: () => void;
};

export function PropFirmDeskTradeSetup({
  config,
  updateField,
  monitorIntervalSeconds,
  setMonitorIntervalSeconds,
  validation,
  connected,
  autoTrading,
  streaming,
  monitoring,
  statusLine,
  onStartAuto,
  onStopAuto,
  propFirmRules,
  activeProfileId,
  symbolOptions,
  useRuleSymbols,
  rulesReady,
  onEditRules,
}: PropFirmDeskTradeSetupProps) {
  const busy = streaming || monitoring || autoTrading;
  const profitTarget = propFirmRules.profit_target_pct;
  const accountSize = propFirmRules.account_size;

  return (
    <Card
      title="Evaluation session"
      subtitle="Prop firm desk only — symbol and timing follow your saved rules profile, not the general Multi-Agent page"
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l8 4v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
      action={
        onEditRules ? (
          <button
            type="button"
            onClick={onEditRules}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Edit rules
          </button>
        ) : null
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-3)]/40 px-3 py-2.5">
        {activeProfileId != null ? (
          <Badge tone="info">Profile #{activeProfileId}</Badge>
        ) : (
          <Badge tone="warning">No saved profile</Badge>
        )}
        <Badge tone={rulesReady ? "success" : "default"}>{propFirmRulesSummary(propFirmRules)}</Badge>
        {profitTarget != null && profitTarget > 0 && (
          <span className="text-[11px] text-[var(--muted)]">
            Target {profitTarget}%
            {accountSize != null && accountSize > 0 ? ` · $${accountSize.toLocaleString()} account` : ""}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <FieldLabel>Allowed symbol (from rules)</FieldLabel>
          {useRuleSymbols && symbolOptions.length > 0 ? (
            <>
              <select
                value={config.symbol}
                onChange={(e) => updateField("symbol", e.target.value)}
                className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 font-mono text-sm uppercase text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent),transparent_72%)]"
              >
                {symbolOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--muted)]">
                Only symbols listed in your prop firm rules. Update allowed symbols on the Rules tab.
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--warning)]/50 bg-[color-mix(in_oklab,var(--warning),transparent_94%)] px-4 py-3 text-sm text-[var(--foreground)]">
              Add <strong>allowed symbols</strong> in your rules (Rules tab), save to the database, then return here.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Desk trading mode</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {TRADING_MODE_OPTIONS.filter((o) =>
              ["auto", "day_trader", "swing_trader", "scalper", "mean_reversion"].includes(o.id),
            ).map((option) => {
              const active = config.trading_mode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateField("trading_mode", option.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "pill-active"
                      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">Compliance still enforced from your saved profile.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Strategy filter</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {STRATEGY_OPTIONS.filter((o) => o.id !== "breakout_retest").map((option) => {
              const active = config.trading_strategy === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => updateField("trading_strategy", option.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "pill-active"
                      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <FieldLabel>Challenge notes for the desk (optional)</FieldLabel>
          <textarea
            value={config.user_prompt}
            onChange={(e) => updateField("user_prompt", e.target.value)}
            maxLength={800}
            placeholder="Example: Phase 1 — prioritize capital preservation; no trades 30m before high-impact news."
            className="min-h-[72px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent),transparent_72%)]"
          />
          <div className="flex justify-end text-[11px] text-[var(--muted)]">
            {config.user_prompt.length}/800
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Position review cadence</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {PROP_FIRM_MONITOR_INTERVAL_OPTIONS.map((opt) => {
              const active = monitorIntervalSeconds === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setMonitorIntervalSeconds(opt)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "pill-active"
                      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {opt}s
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Team lead reviews open trades on this schedule until flat or stopped.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Flat-market scan interval</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {PROP_FIRM_ENTRY_INTERVAL_OPTIONS.map((opt) => {
              const active = config.auto_trade_entry_interval_seconds === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updateField("auto_trade_entry_interval_seconds", opt)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "pill-active"
                      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {opt}s
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Minimum gap between full desk entry cycles when no position is open (evaluation-safe pacing).
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 p-3 transition hover:border-[var(--border-strong)] lg:col-span-2">
          <input
            type="checkbox"
            checked={config.wait_for_new_candle}
            onChange={(e) => updateField("wait_for_new_candle", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border)] bg-[var(--surface-2)] accent-[var(--accent)]"
          />
          <div>
            <div className="text-sm text-[var(--foreground)]">Wait for new candle</div>
            <div className="text-[11px] text-[var(--muted)]">Recommended for evaluation — avoids mid-bar entries.</div>
          </div>
        </label>

        <div className="flex items-start gap-2.5 rounded-lg border border-[color-mix(in_oklab,var(--success),transparent_70%)] bg-[color-mix(in_oklab,var(--success),transparent_92%)] p-3 lg:col-span-2">
          <span className="mt-0.5 text-[var(--success)]" aria-hidden>
            ✓
          </span>
          <div>
            <div className="text-sm font-medium text-[var(--foreground)]">Live execution required</div>
            <div className="text-[11px] text-[var(--muted)]">
              The evaluation desk always sends compliant orders when the team agrees. Dry-run is not available here.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          loading={autoTrading}
          disabled={busy || validation.length > 0 || !connected || !isPropFirmRulesActive(propFirmRules)}
          onClick={onStartAuto}
        >
          {!autoTrading && (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 3l14 9-14 9V3z" strokeLinejoin="round" />
            </svg>
          )}
          {autoTrading ? "Evaluation running…" : "Start evaluation desk"}
        </Button>
        {autoTrading && (
          <Button variant="danger" onClick={onStopAuto}>
            Stop evaluation
          </Button>
        )}
        {validation.length > 0 && (
          <span className="text-[11px] text-[var(--warning)]">{validation[0]}</span>
        )}
        {statusLine && (
          <span className="ml-auto truncate text-[11px] text-[var(--muted)]" title={statusLine}>
            {statusLine}
          </span>
        )}
      </div>
    </Card>
  );
}
