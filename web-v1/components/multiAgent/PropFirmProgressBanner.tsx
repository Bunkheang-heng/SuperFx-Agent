"use client";

import { Badge } from "@/components/ui";
import type { EvaluationProgress } from "@/lib/multiAgent";

type PropFirmProgressBannerProps = {
  progress: EvaluationProgress | null | undefined;
  profitTargetPct?: number | null;
  accountSize?: number | null;
  firmName?: string | null;
};

function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function fmtMoney(pct: number | null | undefined, accountSize: number | null | undefined): string {
  if (pct == null || accountSize == null || accountSize <= 0 || Number.isNaN(pct)) return "";
  const amount = (accountSize * pct) / 100;
  return ` ($${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })})`;
}

export function PropFirmProgressBanner({
  progress,
  profitTargetPct,
  accountSize,
  firmName,
}: PropFirmProgressBannerProps) {
  const target = progress?.profit_target_pct ?? profitTargetPct ?? null;
  const targetMet = Boolean(progress?.target_met);
  const progressPct = progress?.progress_to_target_pct;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        targetMet
          ? "border-[var(--success)]/40 bg-[color-mix(in_srgb,var(--success)_12%,transparent)]"
          : "border-[var(--accent)]/30 bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {firmName?.trim() || "Prop firm evaluation"}
          </p>
          <p className="mt-0.5 text-sm text-[var(--foreground)]">
            Profit {fmtPct(progress?.profit_pct)} / target{" "}
            {target != null ? `${fmtPct(target)}${fmtMoney(target, accountSize)}` : "—"}
            {progress?.remaining_to_target_pct != null && !targetMet && (
              <span className="text-[var(--muted)]">
                {" "}
                · {fmtPct(progress.remaining_to_target_pct)} left
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {targetMet ? (
            <Badge tone="success">Target met — no new entries</Badge>
          ) : progressPct != null ? (
            <Badge tone="info">{progressPct.toFixed(0)}% to target</Badge>
          ) : (
            <Badge tone="default">Run desk for live progress</Badge>
          )}
        </div>
      </div>
      {(progress?.daily_loss_pct != null || progress?.drawdown_pct != null) && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {progress.daily_loss_pct != null && progress.max_daily_loss_pct != null && (
            <span>
              Daily loss {fmtPct(progress.daily_loss_pct)} / {fmtPct(progress.max_daily_loss_pct)} max
            </span>
          )}
          {progress.drawdown_pct != null && progress.max_drawdown_pct != null && (
            <span className={progress.daily_loss_pct != null ? " · " : ""}>
              Drawdown {fmtPct(progress.drawdown_pct)} / {fmtPct(progress.max_drawdown_pct)} max
            </span>
          )}
        </p>
      )}
    </div>
  );
}
