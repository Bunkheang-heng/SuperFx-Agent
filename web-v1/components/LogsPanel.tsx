"use client";

import { useEffect, useState } from "react";
import { api, type AllRecentLogs, type LogEntry } from "@/lib/api";
import { Button, Card } from "./ui";

const TABS = ["snapshots", "decisions", "orders", "errors"] as const;
type Tab = (typeof TABS)[number];

const TAB_META: Record<Tab, { label: string; icon: React.ReactNode }> = {
  snapshots: {
    label: "Snapshots",
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18" />
      </svg>
    ),
  },
  decisions: {
    label: "Decisions",
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  orders: {
    label: "Orders",
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8L5 8z" />
        <path d="M9 8V6a3 3 0 1 1 6 0v2" />
      </svg>
    ),
  },
  errors: {
    label: "Errors",
    icon: (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l10 18H2L12 3z" strokeLinejoin="round" />
        <path d="M12 10v4M12 17h.01" strokeLinecap="round" />
      </svg>
    ),
  },
};

export function LogsPanel({ onError }: { onError: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>("decisions");
  const [data, setData] = useState<AllRecentLogs>({});
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await api.allRecent(25);
      setData(r);
      setLastRefreshed(new Date());
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const kickoff = setTimeout(() => {
      void refresh();
    }, 0);
    const id = setInterval(() => {
      void refresh();
    }, 10_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = (data[tab] ?? []).slice().reverse();

  return (
    <Card
      title="Recent Activity"
      subtitle={
        lastRefreshed
          ? `Auto-refreshes every 10s · last ${lastRefreshed.toLocaleTimeString()}`
          : "Auto-refreshes every 10s"
      }
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      }
      action={
        <Button variant="ghost" size="sm" onClick={refresh} loading={loading}>
          {!loading && (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-3-6.7" strokeLinecap="round" />
              <path d="M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {loading ? "Refreshing" : "Refresh"}
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const active = tab === t;
          const count = data[t]?.length ?? 0;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium capitalize transition ${
                active
                  ? "pill-active"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
              }`}
            >
              {TAB_META[t].icon}
              {TAB_META[t].label}
              <span
                className={`ml-0.5 inline-flex min-w-[1.25rem] justify-center rounded-md px-1 text-[10px] ${
                  active
                    ? "bg-[color-mix(in_oklab,var(--accent),transparent_72%)] text-white"
                    : "bg-[var(--surface-3)] text-[var(--muted)]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-3)]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
              {TAB_META[tab].icon}
            </div>
            <div className="text-sm text-[var(--foreground)]">No {TAB_META[tab].label.toLowerCase()} yet</div>
            <div className="text-[11px] text-[var(--muted)]">
              Events will appear here as they&apos;re emitted by the engine.
            </div>
          </div>
        ) : (
          <ul className="max-h-80 divide-y divide-[var(--border)] overflow-auto">
            {items.map((it, i) => (
              <LogRow key={i} entry={it} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const isError = entry.level === "error";
  const levelClass = isError ? "text-[var(--danger)]" : "text-[var(--accent-2)]";
  return (
    <li className="group flex items-start gap-3 px-3 py-2.5 text-xs transition hover:bg-[var(--surface-2)]/40">
      <span
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
          isError ? "bg-[var(--danger)]" : "bg-[var(--accent-2)]"
        }`}
      />
      <time className="w-20 shrink-0 font-mono text-[var(--muted)]">
        {new Date(entry.timestamp).toLocaleTimeString()}
      </time>
      <span className={`w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wide ${levelClass}`}>
        {entry.level}
      </span>
      <span className="min-w-0 flex-1 break-words text-[var(--foreground)]/92">
        {entry.message}
        {entry.extra && Object.keys(entry.extra).length > 0 && (
          <span className="mt-1 block truncate font-mono text-[11px] text-[var(--muted)] group-hover:whitespace-normal group-hover:text-[var(--muted)]">
            {JSON.stringify(entry.extra)}
          </span>
        )}
      </span>
    </li>
  );
}
