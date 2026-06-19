"use client";

import { Badge, Card, Dot, LiveValue, StatTile } from "@/components/ui";
import { type LivePosition, type MonitorAction, type MonitorDecision } from "@/lib/multiAgent";

export type DecisionLogEntry = {
  id: string;
  iteration: number;
  action: MonitorAction | "entry";
  reason: string;
  newSl?: number | null;
  newTp?: number | null;
  timestamp: number;
  ok?: boolean;
};

export function LivePositionCard({
  symbol,
  position,
  iteration,
  intervalSeconds,
  monitoring,
  onStop,
  decisionLog,
  lastDecision,
  countdownMs,
  embedded = false,
}: {
  symbol: string;
  position: LivePosition | null;
  iteration: number;
  intervalSeconds: number;
  monitoring: boolean;
  onStop?: () => void;
  decisionLog: DecisionLogEntry[];
  lastDecision: MonitorDecision | null;
  countdownMs: number | null;
  /** Render without Card chrome (e.g. inside LivePositionSidebar) */
  embedded?: boolean;
}) {
  const isOpen = !!position?.open;
  const profit = position?.profit ?? 0;
  const tone = profit > 0 ? "success" : profit < 0 ? "danger" : "default";

  const distanceToSl = computeDistance(position, "sl");
  const distanceToTp = computeDistance(position, "tp");
  const slPct = computeProgress(position, "sl");
  const tpPct = computeProgress(position, "tp");

  const symbolFmt = (n: number | null | undefined, digits = 5) =>
    n == null ? "-" : Number(n).toFixed(digits);

  const body = (
    <>
      {!embedded && (
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <Badge tone={monitoring ? "accent" : "default"}>
            <Dot tone={monitoring ? "accent" : "muted"} pulse={monitoring} />
            {monitoring ? `monitoring #${iteration}` : "stopped"}
          </Badge>
          {monitoring && onStop && (
            <button
              type="button"
              onClick={onStop}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
            >
              Stop monitoring
            </button>
          )}
        </div>
      )}
      {embedded && monitoring && onStop && (
        <div className="mb-4">
          <button
            type="button"
            onClick={onStop}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            Stop monitoring
          </button>
        </div>
      )}
      {!isOpen ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-10 text-sm text-[var(--muted)]">
          Run a cycle to open a position. The team will start monitoring it automatically.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className={`grid grid-cols-2 gap-2 ${embedded ? "" : "sm:grid-cols-4"}`}>
            <StatTile
              label="Side"
              value={(position?.side ?? "-").toUpperCase()}
              tone={position?.side === "buy" ? "success" : position?.side === "sell" ? "danger" : "default"}
            />
            <StatTile label="Volume" value={`${position?.volume?.toFixed(2) ?? "-"} lot`} />
            <StatTile
              label="P/L"
              value={
                <LiveValue
                  value={profit}
                  display={`${profit >= 0 ? "+" : ""}${profit.toFixed(2)}`}
                />
              }
              tone={tone}
            />
            <StatTile
              label="Next review"
              value={
                monitoring
                  ? countdownMs != null
                    ? `${Math.max(0, Math.ceil(countdownMs / 1000))}s`
                    : "..."
                  : "-"
              }
            />
          </div>

          <div className={`grid gap-2 ${embedded ? "grid-cols-1" : "sm:grid-cols-3"}`}>
            <StatTile label="Entry" value={symbolFmt(position?.entry_price ?? null)} />
            <StatTile label="Current" value={symbolFmt(position?.current_price ?? null)} />
            <StatTile
              label="Tickets"
              value={position?.tickets?.length ? position.tickets.join(", ") : "-"}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3">
            <PriceBar
              label="Distance to Stop Loss"
              valueLabel={
                position?.stop_loss != null
                  ? `${symbolFmt(position.stop_loss)} (${distanceToSl ?? "-"})`
                  : "no stop"
              }
              progress={slPct}
              tone="danger"
            />
            <PriceBar
              label="Distance to Take Profit"
              valueLabel={
                position?.take_profit != null
                  ? `${symbolFmt(position.take_profit)} (${distanceToTp ?? "-"})`
                  : "no target"
              }
              progress={tpPct}
              tone="success"
            />
          </div>

          {lastDecision && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-3">
              <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">
                Latest team-lead call
                <ActionBadge action={lastDecision.action} />
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--foreground)]/90">
                {lastDecision.reason || "(no rationale provided)"}
              </p>
              {lastDecision.action === "modify" && (
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
                  {lastDecision.new_stop_loss != null && (
                    <span className="rounded-md border border-[var(--border)] bg-[var(--surface-3)] px-2 py-0.5 font-mono">
                      new SL = {Number(lastDecision.new_stop_loss).toFixed(5)}
                    </span>
                  )}
                  {lastDecision.new_take_profit != null && (
                    <span className="rounded-md border border-[var(--border)] bg-[var(--surface-3)] px-2 py-0.5 font-mono">
                      new TP = {Number(lastDecision.new_take_profit).toFixed(5)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {decisionLog.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Decision history
          </div>
          <ul className="flex flex-col gap-1.5">
            {decisionLog.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 px-3 py-2 text-[12px]"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-3)] px-1.5 text-[10px] text-[var(--muted)]">
                    #{entry.iteration}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ActionBadge action={entry.action} />
                      {entry.ok === false && (
                        <Badge tone="danger">
                          <Dot tone="danger" />
                          failed
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-[var(--foreground)]/85">
                      {entry.reason}
                    </p>
                    {(entry.newSl != null || entry.newTp != null) && (
                      <div className="mt-1 flex flex-wrap gap-2 text-[10.5px] text-[var(--muted)]">
                        {entry.newSl != null && (
                          <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 font-mono">
                            SL {entry.newSl.toFixed(5)}
                          </span>
                        )}
                        {entry.newTp != null && (
                          <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 font-mono">
                            TP {entry.newTp.toFixed(5)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] text-[var(--muted)]">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="flex flex-col">{body}</div>;
  }

  return (
    <Card
      title="Live Position"
      subtitle={
        isOpen
          ? `Team monitoring ${symbol} every ${intervalSeconds}s`
          : "No position currently open"
      }
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h4l3 -8 4 16 3 -8 4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
      action={
        <div className="flex items-center gap-2">
          <Badge tone={monitoring ? "accent" : "default"}>
            <Dot tone={monitoring ? "accent" : "muted"} pulse={monitoring} />
            {monitoring ? `monitoring #${iteration}` : "stopped"}
          </Badge>
          {monitoring && onStop && (
            <button
              type="button"
              onClick={onStop}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition"
            >
              Stop
            </button>
          )}
        </div>
      }
    >
      {body}
    </Card>
  );
}

function ActionBadge({ action }: { action: MonitorAction | "entry" }) {
  const map: Record<string, { tone: "success" | "danger" | "warning" | "accent"; label: string }> = {
    entry: { tone: "accent", label: "ENTRY" },
    hold: { tone: "accent", label: "HOLD" },
    modify: { tone: "warning", label: "MODIFY" },
    close: { tone: "danger", label: "CLOSE" },
  };
  const cfg = map[action] ?? { tone: "accent" as const, label: action.toUpperCase() };
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>;
}

function PriceBar({
  label,
  valueLabel,
  progress,
  tone,
}: {
  label: string;
  valueLabel: string;
  progress: number | null;
  tone: "success" | "danger";
}) {
  const pct = progress == null ? 0 : Math.max(0, Math.min(100, progress));
  const barColor =
    tone === "success" ? "bg-[var(--success)]" : "bg-[var(--danger)]";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--muted)]">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-[var(--foreground)]/85">{valueLabel}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className={`h-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function computeDistance(position: LivePosition | null, kind: "sl" | "tp"): string | null {
  if (!position?.open) return null;
  const target = kind === "sl" ? position.stop_loss : position.take_profit;
  if (target == null || position.current_price == null) return null;
  const diff = Math.abs(position.current_price - target);
  return diff.toFixed(Math.max(1, digitsFor(position.current_price)));
}

function computeProgress(position: LivePosition | null, kind: "sl" | "tp"): number | null {
  if (!position?.open) return null;
  const entry = position.entry_price;
  const cur = position.current_price;
  const target = kind === "sl" ? position.stop_loss : position.take_profit;
  if (entry == null || cur == null || target == null) return null;
  const total = Math.abs(target - entry);
  if (total <= 0) return null;
  const moved = Math.abs(cur - entry);
  if (kind === "sl") {
    const movingTowardSL =
      (position.side === "buy" && cur < entry) ||
      (position.side === "sell" && cur > entry);
    return movingTowardSL ? Math.min(100, (moved / total) * 100) : 0;
  }
  const movingTowardTP =
    (position.side === "buy" && cur > entry) ||
    (position.side === "sell" && cur < entry);
  return movingTowardTP ? Math.min(100, (moved / total) * 100) : 0;
}

function digitsFor(price: number): number {
  if (price >= 1000) return 2;
  if (price >= 100) return 3;
  if (price >= 10) return 4;
  return 5;
}
