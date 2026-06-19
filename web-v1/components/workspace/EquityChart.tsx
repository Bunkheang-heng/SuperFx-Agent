"use client";

import { useMemo } from "react";
import type { EquityCurvePoint } from "@/lib/api";

function fmtMoney(n: number, currency?: string | null): string {
  const formatted = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function EquityChart({
  points,
  currency,
  change,
  changePct,
  loading,
}: {
  points: EquityCurvePoint[];
  currency?: string | null;
  change?: number;
  changePct?: number;
  loading?: boolean;
}) {
  const layout = useMemo(() => {
    if (points.length < 2) return null;

    const width = 1000;
    const height = 260;
    const padL = 8;
    const padR = 8;
    const padT = 16;
    const padB = 28;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const equities = points.map((p) => p.equity);
    let minY = Math.min(...equities);
    let maxY = Math.max(...equities);
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }
    const padY = (maxY - minY) * 0.08 || 1;
    minY -= padY;
    maxY += padY;

    const minT = points[0].time;
    const maxT = points[points.length - 1].time;
    const spanT = maxT - minT || 1;

    const coords = points.map((p) => {
      const x = padL + ((p.time - minT) / spanT) * innerW;
      const y = padT + innerH - ((p.equity - minY) / (maxY - minY)) * innerH;
      return { x, y, ...p };
    });

    const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
    const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(2)},${(padT + innerH).toFixed(2)} L${coords[0].x.toFixed(2)},${(padT + innerH).toFixed(2)} Z`;

    const changeTone = (change ?? 0) >= 0 ? "up" : "down";
    const stroke = changeTone === "up" ? "var(--success)" : "var(--danger)";
    const fillId = `equity-fill-${changeTone}`;

    return {
      width,
      height,
      coords,
      linePath,
      areaPath,
      stroke,
      fillId,
      minY,
      maxY,
      minT,
      maxT,
      startLabel: fmtDate(minT),
      endLabel: fmtDate(maxT),
      minLabel: fmtMoney(minY, currency),
      maxLabel: fmtMoney(maxY, currency),
    };
  }, [points, currency, change]);

  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50">
        <span className="text-sm text-[var(--muted)]">Loading equity chart…</span>
      </div>
    );
  }

  if (!layout) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50">
        <span className="text-sm text-[var(--muted)]">Not enough history to plot equity yet.</span>
      </div>
    );
  }

  const toneClass = (change ?? 0) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";

  return (
    <div className="w-full min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap gap-4 text-[11px] text-[var(--muted)]">
          <span>
            High <span className="font-mono text-[var(--foreground)]">{layout.maxLabel}</span>
          </span>
          <span>
            Low <span className="font-mono text-[var(--foreground)]">{layout.minLabel}</span>
          </span>
        </div>
        {change != null && changePct != null && (
          <div className={`font-mono text-sm font-semibold ${toneClass}`}>
            {change >= 0 ? "+" : ""}
            {fmtMoney(change, currency)} ({changePct >= 0 ? "+" : ""}
            {changePct.toFixed(2)}%)
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-[220px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40"
        preserveAspectRatio="none"
        role="img"
        aria-label="Equity curve chart"
      >
        <defs>
          <linearGradient id="equity-fill-up" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--success)" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="equity-fill-down" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = 16 + (260 - 44) * ratio;
          return (
            <line
              key={ratio}
              x1={8}
              x2={992}
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeOpacity={0.55}
              strokeDasharray="4 6"
            />
          );
        })}

        <path d={layout.areaPath} fill={`url(#${layout.fillId})`} />
        <path
          d={layout.linePath}
          fill="none"
          stroke={layout.stroke}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle
          cx={layout.coords[layout.coords.length - 1].x}
          cy={layout.coords[layout.coords.length - 1].y}
          r={5}
          fill={layout.stroke}
        />

        <text x={8} y={252} fill="var(--muted)" fontSize={11}>
          {layout.startLabel}
        </text>
        <text x={992} y={252} fill="var(--muted)" fontSize={11} textAnchor="end">
          {layout.endLabel}
        </text>
      </svg>
    </div>
  );
}
