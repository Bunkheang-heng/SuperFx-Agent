"use client";

import { useState } from "react";
import type { ConnectionStatus } from "@/lib/api";
import { Badge, Card, JsonView, LiveValue, SectionTitle, StatTile } from "./ui";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function fmt(v: unknown, digits = 2): string {
  const n = num(v);
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtPrice(v: unknown, digits = 5): string {
  const n = num(v);
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

export function StatusPanel({ status }: { status: ConnectionStatus | null }) {
  const [showRaw, setShowRaw] = useState(false);

  if (!status) {
    return (
      <Card
        title="Live MT5 Status"
        subtitle="Refresh after connecting to inspect live broker state"
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h3l3-9 4 18 3-9h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-[70px]" />
          ))}
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">No status loaded yet.</p>
      </Card>
    );
  }

  const tick = status.tick ?? null;
  const account = status.account ?? null;
  const positions = status.positions ?? [];
  const bid = num(tick?.bid as unknown);
  const ask = num(tick?.ask as unknown);
  const spread = bid != null && ask != null ? ask - bid : null;
  const balance = num(account?.balance as unknown);
  const equity = num(account?.equity as unknown);
  const pnl = balance != null && equity != null ? equity - balance : null;

  return (
    <Card
      title="Live MT5 Status"
      subtitle="Current broker state used before cycle execution"
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h3l3-9 4 18 3-9h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
      action={
        <Badge tone={status.connected ? "success" : "warning"} pulse={status.connected}>
          <span className={`h-1.5 w-1.5 rounded-full ${status.connected ? "bg-[var(--success)]" : "bg-[var(--warning)]"}`} />
          {status.connected ? "Live updating" : "Disconnected"}
        </Badge>
      }
    >
      {/* Market tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Symbol"
          value={String(status.symbol ?? "—")}
          hint={String(status.timeframe ?? "—")}
        />
        <StatTile label="Bid" value={fmtPrice(bid)} tone={bid != null ? "accent" : "default"} />
        <StatTile label="Ask" value={fmtPrice(ask)} tone={ask != null ? "accent" : "default"} />
        <StatTile
          label="Spread"
          value={spread != null ? fmtPrice(spread) : "—"}
          hint={spread != null ? `${(spread * 10000).toFixed(1)} pips` : undefined}
        />
      </div>

      {/* Account tiles */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Balance" value={<LiveValue value={balance} display={fmt(balance)} />} />
        <StatTile label="Equity" value={<LiveValue value={equity} display={fmt(equity)} />} />
        <StatTile
          label="Floating P/L"
          value={<LiveValue value={pnl} display={pnl != null ? (pnl >= 0 ? `+${fmt(pnl)}` : fmt(pnl)) : "—"} />}
          tone={pnl == null ? "default" : pnl >= 0 ? "success" : "danger"}
        />
        <StatTile
          label="Open Positions"
          value={<LiveValue value={positions.length} display={String(positions.length)} />}
          tone={positions.length > 0 ? "accent" : "default"}
        />
      </div>

      {status.error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[color-mix(in_oklab,var(--warning),transparent_55%)] bg-[color-mix(in_oklab,var(--warning),transparent_85%)] px-4 py-3 text-sm text-[var(--warning)]">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l10 18H2L12 3z" strokeLinejoin="round" />
            <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
          </svg>
          <span>{status.error}</span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <SectionTitle>Raw payload</SectionTitle>
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          {showRaw ? "Hide" : "Show"}
        </button>
      </div>
      {showRaw && (
        <div className="mt-2 grid gap-3 xl:grid-cols-3">
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Tick</div>
            <JsonView data={tick} max={220} />
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Account</div>
            <JsonView data={account} max={220} />
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">Positions</div>
            <JsonView data={positions} max={220} />
          </div>
        </div>
      )}
    </Card>
  );
}
