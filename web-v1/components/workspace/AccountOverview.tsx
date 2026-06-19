"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, type ConnectionStatus, type EquityCurvePoint } from "@/lib/api";
import { Badge, Button, Card, LiveValue } from "@/components/ui";
import { EquityChart } from "@/components/workspace/EquityChart";

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

function fmtMoney(v: unknown, currency?: string | null): string {
  const n = num(v);
  if (n == null) return "—";
  const formatted = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

function fmtPct(v: unknown): string {
  const n = num(v);
  if (n == null) return "—";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</span>
      <span className="text-sm font-medium text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  rawValue,
  tone = "default",
}: {
  label: string;
  value: string;
  rawValue?: number | null;
  tone?: "default" | "success" | "danger" | "accent";
}) {
  const toneClass: Record<string, string> = {
    default: "text-[var(--foreground)]",
    success: "text-[var(--success)]",
    danger: "text-[var(--danger)]",
    accent: "text-[var(--accent-2)]",
  };
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/80 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold tracking-tight ${toneClass[tone]}`}>
        <LiveValue value={rawValue ?? null} display={value} />
      </div>
    </div>
  );
}

export function AccountOverview({
  status,
  onRefresh,
}: {
  status: ConnectionStatus | null;
  onRefresh?: () => void;
}) {
  const account = status?.account ?? null;
  const positions = status?.positions ?? [];
  const currency = str(account?.currency);
  const connected = !!status?.connected;

  const [curvePoints, setCurvePoints] = useState<EquityCurvePoint[]>([]);
  const [curveChange, setCurveChange] = useState<number | null>(null);
  const [curveChangePct, setCurveChangePct] = useState<number | null>(null);
  const [curveCurrency, setCurveCurrency] = useState<string | null>(null);
  const [curveLoading, setCurveLoading] = useState(false);

  const loadEquityCurve = useCallback(async () => {
    if (!connected) {
      setCurvePoints([]);
      setCurveChange(null);
      setCurveChangePct(null);
      return;
    }
    setCurveLoading(true);
    try {
      const data = await api.equityCurve(30);
      setCurvePoints(data.points);
      setCurveChange(data.change);
      setCurveChangePct(data.change_pct);
      setCurveCurrency(data.currency ?? currency);
    } catch {
      setCurvePoints([]);
    } finally {
      setCurveLoading(false);
    }
  }, [connected, currency]);

  useEffect(() => {
    void loadEquityCurve();
  }, [loadEquityCurve]);

  const handleRefresh = async () => {
    await onRefresh?.();
    await loadEquityCurve();
  };

  if (status?.connected && !account) {
    return (
      <Card title="Account data unavailable" subtitle="MT5 is connected but account info did not load">
        <p className="text-sm text-[var(--muted)]">
          {status.error ?? "Try refreshing. If this persists, reconnect from Broker settings."}
        </p>
        {onRefresh && (
          <Button variant="secondary" className="mt-4" onClick={() => void handleRefresh()}>
            Refresh account
          </Button>
        )}
      </Card>
    );
  }

  const login = str(account?.login) ?? "—";
  const server = str(account?.server) ?? "—";
  const name = str(account?.name);
  const company = str(account?.company);
  const displayName = name ?? company ?? "MT5 Account";

  const balance = num(account?.balance);
  const equity = num(account?.equity);
  const profit = num(account?.profit);
  const credit = num(account?.credit);
  const margin = num(account?.margin);
  const marginFree = num(account?.margin_free);
  const marginLevel = num(account?.margin_level);
  const leverage = num(account?.leverage);

  const profitTone = profit == null ? "default" : profit >= 0 ? "success" : "danger";

  return (
    <div className="flex flex-col gap-6">
      <Card
        title={displayName}
        subtitle={company && name ? company : "Live broker account"}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" strokeLinecap="round" />
          </svg>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status?.demo_only === false ? "warning" : "info"}>
              {status?.demo_only === false ? "Live" : "Demo"}
            </Badge>
            <Badge tone="success" pulse>
              MT5 connected
            </Badge>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailRow label="Account ID" value={<span className="font-mono">{login}</span>} />
          <DetailRow label="Server" value={<span className="font-mono text-[var(--accent-2)]">{server}</span>} />
          <DetailRow label="Currency" value={currency ?? "—"} />
          <DetailRow
            label="Leverage"
            value={leverage != null ? `1:${Math.round(leverage)}` : "—"}
          />
        </div>

        {(str(account?.trade_mode) || account?.trade_allowed != null) && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {str(account?.trade_mode) && (
              <DetailRow label="Trade mode" value={String(account?.trade_mode)} />
            )}
            {account?.trade_allowed != null && (
              <DetailRow
                label="Trading allowed"
                value={account.trade_allowed ? "Yes" : "No"}
              />
            )}
            {account?.margin_mode != null && (
              <DetailRow label="Margin mode" value={String(account.margin_mode)} />
            )}
            {credit != null && credit !== 0 && (
              <DetailRow label="Credit" value={fmtMoney(credit, currency)} />
            )}
          </div>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Account funds</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Balance" value={fmtMoney(balance, currency)} rawValue={balance} />
          <MetricCard label="Equity" value={fmtMoney(equity, currency)} rawValue={equity} />
          <MetricCard
            label="Floating P/L"
            value={
              profit == null ? "—" : profit >= 0 ? `+${fmtMoney(profit, currency)}` : fmtMoney(profit, currency)
            }
            rawValue={profit}
            tone={profitTone}
          />
          <MetricCard
            label="Open positions"
            value={String(positions.length)}
            rawValue={positions.length}
            tone={positions.length > 0 ? "accent" : "default"}
          />
        </div>
      </div>

      <Card title="Equity curve" subtitle="Last 30 days rebuilt from your MT5 deal history">
        <EquityChart
          points={curvePoints}
          currency={curveCurrency ?? currency}
          change={curveChange ?? undefined}
          changePct={curveChangePct ?? undefined}
          loading={curveLoading}
        />
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">Margin</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Used margin" value={fmtMoney(margin, currency)} rawValue={margin} />
          <MetricCard label="Free margin" value={fmtMoney(marginFree, currency)} rawValue={marginFree} />
          <MetricCard label="Margin level" value={fmtPct(marginLevel)} rawValue={marginLevel} />
        </div>
      </div>

      {positions.length > 0 && (
        <Card title="Open positions" subtitle={`${positions.length} position${positions.length === 1 ? "" : "s"} on this account`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-2 py-2">Symbol</th>
                  <th className="px-2 py-2">Side</th>
                  <th className="px-2 py-2">Volume</th>
                  <th className="px-2 py-2">Profit</th>
                </tr>
              </thead>
              <tbody>
                {positions.slice(0, 8).map((pos, i) => {
                  const p = pos as Record<string, unknown>;
                  const side = num(p.type) === 0 ? "Buy" : num(p.type) === 1 ? "Sell" : str(p.type) ?? "—";
                  const posProfit = num(p.profit);
                  return (
                    <tr key={String(p.ticket ?? i)} className="border-b border-[var(--border)]/60">
                      <td className="px-2 py-2 font-mono text-xs">{str(p.symbol) ?? "—"}</td>
                      <td className="px-2 py-2">{side}</td>
                      <td className="px-2 py-2 font-mono text-xs">{str(p.volume) ?? fmtMoney(p.volume)}</td>
                      <td
                        className={`px-2 py-2 font-mono text-xs ${
                          posProfit == null ? "" : posProfit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                        }`}
                      >
                        {posProfit == null ? "—" : fmtMoney(posProfit, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {positions.length > 8 && (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Showing 8 of {positions.length}. See{" "}
              <Link href="/positions" className="text-[var(--accent)] hover:underline">
                Positions
              </Link>{" "}
              for the full list.
            </p>
          )}
        </Card>
      )}

      {status?.error && !account && (
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--danger),transparent_55%)] bg-[color-mix(in_oklab,var(--danger),transparent_88%)] px-4 py-3 text-sm text-[var(--danger)]">
          {status.error}
        </div>
      )}

      {onRefresh && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void handleRefresh()}>
            Refresh account
          </Button>
        </div>
      )}
    </div>
  );
}
