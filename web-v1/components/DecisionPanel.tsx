"use client";

import { useState } from "react";
import { Badge, Card, JsonView, SectionTitle, StatTile } from "./ui";
import type { RunCycleResult } from "@/lib/api";

export function DecisionPanel({ result }: { result: RunCycleResult | null }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!result) {
    return (
      <Card
        title="Last Cycle Result"
        subtitle="Decision, snapshot and execution"
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16v4H4zM4 12h16v4H4zM4 20h10v0" strokeLinecap="round" />
          </svg>
        }
      >
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 py-10 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="text-sm text-[var(--foreground)]">No decision yet</div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">Run a cycle to see the AI&apos;s reasoning and trade plan.</div>
          </div>
        </div>
      </Card>
    );
  }

  const { decision, snapshot, execution, provider, model } = result;
  const isBuyBias = decision.action.startsWith("buy");
  const isHold = decision.action === "hold";
  const isPending = decision.action.includes("limit") || decision.action.includes("stop");
  const actionTone = isHold ? "warning" : isBuyBias ? "success" : "danger";
  const confidencePct = Math.round((decision.confidence ?? 0) * 100);
  const executed = !!(execution?.executed);
  const statusLabel = isHold ? "Held" : execution?.status === "placed" ? "Placed" : executed ? "Executed" : "Not executed";
  const actionLabel = decision.action.replaceAll("_", " ").toUpperCase();

  return (
    <Card
      title="Last Cycle Result"
      subtitle={`${provider} · ${model} · ${result.trading_mode.replaceAll("_", " ")} · ${result.trading_strategy.replaceAll("_", " ")}`}
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16v4H4zM4 12h16v4H4zM4 20h10v0" strokeLinecap="round" />
        </svg>
      }
      action={
        <Badge tone={isHold ? "warning" : executed ? "success" : "warning"}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isHold ? "bg-[var(--warning)]" : executed ? "bg-[var(--success)]" : "bg-[var(--warning)]"
            }`}
          />
          {statusLabel}
        </Badge>
      }
    >
      {/* Action hero */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 ${
          isHold
            ? "border-[color-mix(in_oklab,var(--warning),transparent_55%)] bg-[color-mix(in_oklab,var(--warning),transparent_88%)]"
            : isBuyBias
            ? "border-[color-mix(in_oklab,var(--success),transparent_55%)] bg-[color-mix(in_oklab,var(--success),transparent_85%)]"
            : "border-[color-mix(in_oklab,var(--danger),transparent_55%)] bg-[color-mix(in_oklab,var(--danger),transparent_85%)]"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`grid h-12 w-12 place-items-center rounded-xl text-white shadow-[0_12px_24px_-10px] ${
                isHold
                  ? "bg-[#f59e0b]"
                  : isBuyBias
                  ? "bg-[#22c55e]"
                  : "bg-[#ef4444]"
              }`}
            >
              {isHold ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M8 6v12M16 6v12" strokeLinecap="round" />
                </svg>
              ) : isBuyBias ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M5 9l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-2xl font-semibold tracking-tight ${
                    isHold ? "text-[var(--warning)]" : isBuyBias ? "text-[var(--success)]" : "text-[var(--danger)]"
                  }`}
                >
                  {actionLabel}
                </span>
                <span className="font-mono text-sm text-[var(--muted)]">{decision.symbol}</span>
              </div>
              <div className="mt-0.5 text-xs text-[var(--muted)]">
                Lot <span className="font-mono text-[var(--foreground)]">{decision.lot_size}</span>
                {decision.entry_price != null && (
                  <> · Entry <span className="font-mono text-[var(--foreground)]">{decision.entry_price}</span></>
                )}
                {decision.stop_loss != null && (
                  <> · SL <span className="font-mono text-[var(--foreground)]">{decision.stop_loss}</span></>
                )}
                {decision.take_profit != null && (
                  <> · TP <span className="font-mono text-[var(--foreground)]">{decision.take_profit}</span></>
                )}
                {isPending && decision.time_in_force && (
                  <> · TIF <span className="font-mono text-[var(--foreground)]">{decision.time_in_force.toUpperCase()}</span></>
                )}
              </div>
            </div>
          </div>

          <div className="w-full sm:w-60">
            <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
              <span>Confidence</span>
              <span
                className={`font-mono ${
                  isHold ? "text-[var(--warning)]" : isBuyBias ? "text-[var(--success)]" : "text-[var(--danger)]"
                }`}
              >
                {confidencePct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  isHold
                    ? "bg-[#f59e0b]"
                    : isBuyBias
                    ? "bg-[#22c55e]"
                    : "bg-[#ef4444]"
                }`}
                style={{ width: `${Math.max(0, Math.min(100, confidencePct))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Symbol" value={decision.symbol} />
        <StatTile label="Lot size" value={decision.lot_size.toString()} />
        <StatTile
          label="Entry"
          value={decision.entry_price?.toString() ?? (isPending ? "Required" : "Market")}
          tone={isPending ? "accent" : "default"}
        />
        <StatTile
          label="Stop loss"
          value={decision.stop_loss?.toString() ?? "None"}
          tone={decision.stop_loss != null ? "danger" : "default"}
        />
        <StatTile
          label="Take profit"
          value={decision.take_profit?.toString() ?? "None"}
          tone={decision.take_profit != null ? "success" : "default"}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Mode" value={result.trading_mode.replaceAll("_", " ")} />
        <StatTile label="Strategy" value={result.trading_strategy.replaceAll("_", " ")} />
        <StatTile label="Order style" value={isPending ? "Pending" : isHold ? "No trade" : "Market"} />
        <StatTile
          label="Time in force"
          value={decision.time_in_force?.toUpperCase() ?? "—"}
          tone={isPending ? "accent" : "default"}
        />
        <StatTile
          label="Cancel after"
          value={
            decision.cancel_if_not_filled_minutes != null
              ? `${decision.cancel_if_not_filled_minutes} min`
              : "—"
          }
          tone={decision.cancel_if_not_filled_minutes != null ? "warning" : "default"}
        />
      </div>

      {/* Reason */}
      <div className="mt-4">
        <SectionTitle>Reason</SectionTitle>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-4 text-sm leading-relaxed text-[var(--foreground)]/92">
          <span
            className={`mr-2 select-none ${
              actionTone === "success"
                ? "text-[var(--success)]"
                : actionTone === "danger"
                ? "text-[var(--danger)]"
                : "text-[var(--warning)]"
            }`}
          >
            &ldquo;
          </span>
          {decision.reason}
          <span
            className={`ml-1 select-none ${
              actionTone === "success"
                ? "text-[var(--success)]"
                : actionTone === "danger"
                ? "text-[var(--danger)]"
                : "text-[var(--warning)]"
            }`}
          >
            &rdquo;
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <SectionTitle>Technical detail</SectionTitle>
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          {showRaw ? "Hide" : "Show"} snapshot + execution
        </button>
      </div>
      {showRaw && (
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Snapshot</div>
            <JsonView data={snapshot} max={240} />
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Execution</div>
            <JsonView data={execution} max={240} />
          </div>
        </div>
      )}
    </Card>
  );
}
