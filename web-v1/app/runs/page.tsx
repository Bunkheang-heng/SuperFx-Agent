"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";
import { runsApi, type TradingRunSummary } from "@/lib/profilesApi";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function toneForRun(run: TradingRunSummary): "success" | "danger" | "warning" | "default" {
  if (run.compliance_passed === false) return "danger";
  if (run.executed) return "success";
  if (run.compliance_passed === true) return "default";
  return "warning";
}

export default function RunsPage() {
  const { onError } = useTradingWorkspace();
  const [runs, setRuns] = useState<TradingRunSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(20);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const rangeStart = total === 0 ? 0 : safePage * pageSize + 1;
  const rangeEnd = Math.min(total, (safePage + 1) * pageSize);

  useEffect(() => {
    const maxPage = Math.max(0, totalPages - 1);
    if (page > maxPage) setPage(maxPage);
  }, [page, totalPages]);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await runsApi.list({
        limit: pageSize,
        offset: safePage * pageSize,
      });
      setRuns(data.runs);
      setTotal(data.total);
      if (safePage > 0 && data.runs.length === 0 && data.total > 0) {
        setPage(Math.max(0, Math.ceil(data.total / pageSize) - 1));
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError, pageSize, safePage]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const goToPage = (next: number) => {
    setPage(Math.max(0, Math.min(totalPages - 1, next)));
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(0);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Card
        title="Recent runs"
        subtitle={total > 0 ? `${total} run${total === 1 ? "" : "s"} recorded` : "Newest first"}
        action={
          <Link
            href="/prop-firm"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--accent)]"
          >
            Prop firm rules
          </Link>
        }
      >
        {loading && runs.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">Loading runs…</div>
        ) : runs.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No runs recorded yet. Execute a trade cycle to populate the log.</div>
        ) : (
          <>
            <div className={loading ? "pointer-events-none opacity-60" : undefined}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-2 py-2">ID</th>
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Symbol</th>
                      <th className="px-2 py-2">Compliance</th>
                      <th className="px-2 py-2">Executed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id} className="border-b border-[var(--border)]/60">
                        <td className="px-2 py-2 font-mono text-xs">#{run.id}</td>
                        <td className="px-2 py-2 text-xs text-[var(--muted)]">
                          {new Date(run.created_at).toLocaleString()}
                        </td>
                        <td className="px-2 py-2">{run.run_type}</td>
                        <td className="px-2 py-2 font-mono text-xs">{run.symbol}</td>
                        <td className="px-2 py-2">
                          <Badge tone={toneForRun(run)}>
                            {run.compliance_passed === false
                              ? "Blocked"
                              : run.compliance_passed
                                ? "Passed"
                                : "N/A"}
                          </Badge>
                          {run.compliance_summary && (
                            <div className="mt-1 max-w-xs text-[11px] text-[var(--muted)]">{run.compliance_summary}</div>
                          )}
                        </td>
                        <td className="px-2 py-2">{run.executed ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
              <p className="text-xs text-[var(--muted)]">
                {total === 0
                  ? "No runs"
                  : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
                {loading ? " · Loading…" : null}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  Per page
                  <select
                    value={pageSize}
                    onChange={(e) => changePageSize(Number(e.target.value))}
                    className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--foreground)]"
                    disabled={loading}
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>

                <Button
                  variant="secondary"
                  onClick={() => goToPage(safePage - 1)}
                  disabled={loading || safePage <= 0}
                >
                  Previous
                </Button>
                <span className="min-w-[5rem] text-center text-xs text-[var(--muted)]">
                  Page {safePage + 1} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  onClick={() => goToPage(safePage + 1)}
                  disabled={loading || safePage >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
