"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type TradeHistoryItem } from "@/lib/api";
import { Badge, Button, Card, Input, LiveValue, MetricTile, Select } from "@/components/ui";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";

type OutcomeFilter = "all" | "win" | "loss" | "breakeven";
type HistoryFilters = {
  symbol: string;
  outcome: OutcomeFilter;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_FILTERS: HistoryFilters = {
  symbol: "",
  outcome: "all",
  dateFrom: "",
  dateTo: "",
};

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function fmt(v: unknown, digits = 2): string {
  const n = asNumber(v);
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtPrice(v: unknown): string {
  const n = asNumber(v);
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 });
}

function fmtTime(v: unknown): string {
  const n = asNumber(v);
  if (n == null) return "—";
  return new Date(n * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getProfitTone(profit: number | null): "default" | "success" | "danger" {
  if (profit == null) return "default";
  return profit >= 0 ? "success" : "danger";
}

export default function HistoryPage() {
  const { status, onError } = useTradingWorkspace();
  const connected = !!status?.connected;
  const [items, setItems] = useState<TradeHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);

  const loadHistory = useCallback(async () => {
    if (!connected) {
      setItems([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    try {
      const response = await api.history({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        lookbackDays: 30,
        symbol: filters.symbol || undefined,
        outcomeFilter: filters.outcome,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      setItems(response.items);
      setTotalCount(response.total_count);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to load trade history.");
    } finally {
      setLoading(false);
    }
  }, [connected, filters, onError, page, pageSize]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => {
      void loadHistory();
    }, 0);

    return () => window.clearTimeout(kickoff);
  }, [loadHistory]);

  useEffect(() => {
    if (!connected) return;

    const id = window.setInterval(() => {
      void loadHistory();
    }, 10000);

    return () => window.clearInterval(id);
  }, [connected, loadHistory]);

  const pageProfit = useMemo(
    () => items.reduce((sum, item) => sum + (asNumber(item.profit) ?? 0), 0),
    [items],
  );
  const pageVolume = useMemo(
    () => items.reduce((sum, item) => sum + (asNumber(item.volume) ?? 0), 0),
    [items],
  );
  const winCount = useMemo(() => items.filter((item) => (asNumber(item.profit) ?? 0) > 0).length, [items]);
  const lossCount = useMemo(() => items.filter((item) => (asNumber(item.profit) ?? 0) < 0).length, [items]);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);

  const applyFilters = useCallback(() => {
    if (draftFilters.dateFrom && draftFilters.dateTo && draftFilters.dateFrom > draftFilters.dateTo) {
      onError("Start date must be before end date.");
      return;
    }
    setPage(1);
    setFilters(draftFilters);
  }, [draftFilters, onError]);

  const resetFilters = useCallback(() => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => void loadHistory()} loading={loading}>
          Refresh History
        </Button>
      </div>

      <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <MetricTile label="Matched Deals" value={<LiveValue value={totalCount} display={String(totalCount)} />} />
        <MetricTile label="Visible Rows" value={<LiveValue value={items.length} display={String(items.length)} />} />
        <MetricTile
          label="Page P/L"
          tone={pageProfit >= 0 ? "success" : "danger"}
          value={<LiveValue value={pageProfit} display={pageProfit >= 0 ? `+${fmt(pageProfit)}` : fmt(pageProfit)} />}
        />
        <MetricTile label="Page Volume" value={<LiveValue value={pageVolume} display={fmt(pageVolume, 2)} />} tone="accent" />
      </div>

      {!connected ? (
        <Card
          title="MT5 Not Connected"
          subtitle="Connect your broker terminal first to load account trading history."
        >
          <div className="text-sm text-[var(--muted)]">Once MT5 is connected, this page will automatically load the recent executed deals.</div>
        </Card>
      ) : (
        <Card
          title="Trade History Ledger"
          subtitle="Filter by result, symbol, and date range, then move through the matching history with pagination."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{rangeStart}-{rangeEnd} of {totalCount}</Badge>
              <Badge tone={filters.outcome === "all" ? "default" : filters.outcome === "win" ? "success" : filters.outcome === "loss" ? "danger" : "warning"}>
                {filters.outcome}
              </Badge>
              <Badge tone={pageProfit >= 0 ? "success" : "danger"}>
                Page {pageProfit >= 0 ? `+${fmt(pageProfit)}` : fmt(pageProfit)}
              </Badge>
            </div>
          }
          className="overflow-hidden"
          padded={false}
        >
          <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 sm:px-4 sm:py-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Input
                value={draftFilters.symbol}
                onChange={(event) => setDraftFilters((prev) => ({ ...prev, symbol: event.target.value }))}
                placeholder="Filter by symbol"
              />
              <Select
                value={draftFilters.outcome}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, outcome: event.target.value as OutcomeFilter }))
                }
              >
                <option value="all">All results</option>
                <option value="win">Wins only</option>
                <option value="loss">Losses only</option>
                <option value="breakeven">Breakeven only</option>
              </Select>
              <Input
                type="date"
                value={draftFilters.dateFrom}
                onChange={(event) => setDraftFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
              />
              <Input
                type="date"
                value={draftFilters.dateTo}
                onChange={(event) => setDraftFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
              />
              <Select
                value={String(pageSize)}
                onChange={(event) => {
                  setPage(1);
                  setPageSize(Number(event.target.value));
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </Select>
              <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
                <Button variant="primary" onClick={applyFilters} loading={loading}>
                  Apply
                </Button>
                <Button variant="ghost" onClick={resetFilters}>
                  Reset
                </Button>
              </div>
            </div>
          </div>

          <div className="w-full min-w-0">
            <table className="w-full table-fixed border-collapse text-[11px]">
              <colgroup>
                <col className="w-[15%]" />
                <col className="w-[7%]" />
                <col className="w-[5%]" />
                <col className="w-[5%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
                <col className="w-[19%]" />
              </colgroup>
              <thead>
                <tr className="border-y border-[var(--border)] bg-[var(--surface-3)] text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                  <th className="px-2 py-2 text-left font-semibold sm:px-3">Time</th>
                  <th className="px-2 py-2 text-left font-semibold sm:px-3">Symbol</th>
                  <th className="px-2 py-2 text-left font-semibold sm:px-3">Type</th>
                  <th className="px-2 py-2 text-left font-semibold sm:px-3">Entry</th>
                  <th className="px-2 py-2 text-left font-semibold sm:px-3">Deal</th>
                  <th className="px-2 py-2 text-left font-semibold sm:px-3">Order</th>
                  <th className="px-2 py-2 text-right font-semibold sm:px-3">Vol</th>
                  <th className="px-2 py-2 text-right font-semibold sm:px-3">Price</th>
                  <th className="px-2 py-2 text-right font-semibold sm:px-3">Profit</th>
                  <th className="px-2 py-2 text-right font-semibold sm:px-3">Comm</th>
                  <th className="px-2 py-2 text-right font-semibold sm:px-3">Swap</th>
                  <th className="px-2 py-2 text-left font-semibold sm:px-3">Comment</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                      {loading ? "Loading history..." : "No trades matched the current filters."}
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const profit = asNumber(item.profit);
                    const profitTone = getProfitTone(profit);
                    const type = item.type?.toLowerCase?.() ?? "—";
                    const isBuy = type === "buy";
                    const isSell = type === "sell";

                    return (
                      <tr
                        key={`${item.ticket}-${item.time_msc ?? item.time}`}
                        className="border-b border-[var(--border)]/70 bg-[var(--surface)]/35 text-[12px] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)]/75"
                      >
                        <td className="truncate px-2 py-1.5 font-mono text-[10px] text-[var(--muted)] sm:px-3 sm:py-2" title={fmtTime(item.time)}>
                          {fmtTime(item.time)}
                        </td>
                        <td className="truncate px-2 py-1.5 font-medium sm:px-3 sm:py-2" title={String(item.symbol ?? "")}>
                          {String(item.symbol ?? "—").toLowerCase()}
                        </td>
                        <td
                          className={`truncate px-2 py-1.5 font-medium sm:px-3 sm:py-2 ${
                            isBuy ? "text-[var(--success)]" : isSell ? "text-[var(--danger)]" : "text-[var(--foreground)]"
                          }`}
                        >
                          {type}
                        </td>
                        <td className="truncate px-2 py-1.5 sm:px-3 sm:py-2">{item.entry}</td>
                        <td className="truncate px-2 py-1.5 font-mono text-[10px] text-[var(--muted)] sm:px-3 sm:py-2" title={String(item.ticket)}>
                          {String(item.ticket)}
                        </td>
                        <td className="truncate px-2 py-1.5 font-mono text-[10px] text-[var(--muted)] sm:px-3 sm:py-2" title={String(item.order ?? "")}>
                          {String(item.order ?? "—")}
                        </td>
                        <td className="truncate px-2 py-1.5 text-right font-mono sm:px-3 sm:py-2">{fmt(item.volume, 2)}</td>
                        <td className="truncate px-2 py-1.5 text-right font-mono sm:px-3 sm:py-2">{fmtPrice(item.price)}</td>
                        <td
                          className={`truncate px-2 py-1.5 text-right font-mono sm:px-3 sm:py-2 ${
                            profitTone === "success"
                              ? "text-[var(--success)]"
                              : profitTone === "danger"
                                ? "text-[var(--danger)]"
                                : "text-[var(--foreground)]"
                          }`}
                        >
                          <LiveValue
                            value={profit}
                            display={profit == null ? "—" : profit >= 0 ? `+${fmt(profit)}` : fmt(profit)}
                          />
                        </td>
                        <td className="truncate px-2 py-1.5 text-right font-mono sm:px-3 sm:py-2">{fmt(item.commission)}</td>
                        <td className="truncate px-2 py-1.5 text-right font-mono sm:px-3 sm:py-2">{fmt(item.swap)}</td>
                        <td className="truncate px-2 py-1.5 text-[var(--muted)] sm:px-3 sm:py-2" title={item.comment || undefined}>
                          {item.comment || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[11px] text-[var(--muted)]">
            <div className="flex flex-wrap items-center gap-4">
              <span>Showing {rangeStart}-{rangeEnd} of {totalCount}</span>
              <span>Wins on page: {winCount}</span>
              <span>Losses on page: {lossCount}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1 || loading}>
                Previous
              </Button>
              <span>
                Page {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

