"use client";

import { Button, Card, FieldLabel, Input } from "@/components/ui";
import type { DeskTradeSetupProps } from "@/components/multiAgent/deskSetupTypes";
import {
  AUTO_ENTRY_INTERVAL_OPTIONS,
  MONITOR_INTERVAL_OPTIONS,
  QUICK_SYMBOLS,
  STRATEGY_OPTIONS,
  TRADING_MODE_OPTIONS,
} from "@/components/multiAgent/deskSetupConstants";

export function StandardDeskTradeSetup({
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
}: DeskTradeSetupProps) {
  const busy = streaming || monitoring || autoTrading;

  return (
    <Card
      title="Run configuration"
      subtitle="General multi-agent desk — symbol, style, and auto-trading cadence (saved separately from the prop firm desk)"
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
        </svg>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <FieldLabel>Symbol (MT5 Market Watch)</FieldLabel>
          <Input
            value={config.symbol}
            onChange={(e) => updateField("symbol", e.target.value.toUpperCase())}
            placeholder="e.g. XAUUSDm"
            className="font-mono uppercase"
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SYMBOLS.map((s) => {
              const active = config.symbol.toUpperCase() === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateField("symbol", s)}
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition ${
                    active
                      ? "pill-active"
                      : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">
            Use the exact symbol from your broker. This desk does not use prop firm rule symbols — configure funded
            limits on the Prop Firm page.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Trading mode</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {TRADING_MODE_OPTIONS.map((option) => {
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
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Strategy filter</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {STRATEGY_OPTIONS.map((option) => {
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
          <FieldLabel>Notes for all agents (optional)</FieldLabel>
          <textarea
            value={config.user_prompt}
            onChange={(e) => updateField("user_prompt", e.target.value)}
            maxLength={1200}
            placeholder="Example: London session only, avoid news windows, prefer trend continuations."
            className="min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent),transparent_72%)]"
          />
          <div className="flex justify-end text-[11px] text-[var(--muted)]">
            {config.user_prompt.length}/1200
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Open-position review interval</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {MONITOR_INTERVAL_OPTIONS.map((opt) => {
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
          <p className="text-[11px] text-[var(--muted)]">How often the team re-debates while a trade is open.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Pause between flat scans</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {AUTO_ENTRY_INTERVAL_OPTIONS.map((opt) => {
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
                  {opt === 0 ? "No pause" : `${opt}s`}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">Wait time after a flat cycle before the next full agent run.</p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 p-3 transition hover:border-[var(--border-strong)]">
          <input
            type="checkbox"
            checked={config.wait_for_new_candle}
            onChange={(e) => updateField("wait_for_new_candle", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border)] bg-[var(--surface-2)] accent-[var(--accent)]"
          />
          <div>
            <div className="text-sm text-[var(--foreground)]">Wait for new candle</div>
            <div className="text-[11px] text-[var(--muted)]">Hold until the current bar closes before each cycle.</div>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 p-3 transition hover:border-[var(--border-strong)]">
          <input
            type="checkbox"
            checked={config.execute}
            onChange={(e) => updateField("execute", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border)] bg-[var(--surface-2)] accent-[var(--accent)]"
          />
          <div>
            <div className="text-sm text-[var(--foreground)]">Send orders to MT5</div>
            <div className="text-[11px] text-[var(--muted)]">
              Off = analysis only. Monitoring still needs this on for live position management.
            </div>
          </div>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          loading={autoTrading}
          disabled={busy || validation.length > 0 || !connected}
          onClick={onStartAuto}
        >
          {!autoTrading && (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 3l14 9-14 9V3z" strokeLinejoin="round" />
            </svg>
          )}
          {autoTrading ? "Auto-trading…" : "Start auto-trading"}
        </Button>
        {autoTrading && (
          <Button variant="danger" onClick={onStopAuto}>
            Stop
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
