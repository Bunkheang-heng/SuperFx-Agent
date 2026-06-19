"use client";

import { useState } from "react";
import { Badge, Dot } from "./ui";

export function Navbar({
  connected,
  apiOnline,
  apiBase,
  demoOnly = true,
}: {
  connected: boolean;
  apiOnline: boolean | null;
  apiBase: string;
  demoOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyApi = async () => {
    try {
      await navigator.clipboard.writeText(apiBase);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 17l6-6 4 4 7-7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 8h6v6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-semibold tracking-tight">ThinkTrade</h1>
              <Badge tone={demoOnly ? "info" : "warning"}>
                {demoOnly ? "DEMO" : "LIVE"}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">AI Trading Control Center</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-2.5">
          <StatusPill
            label="API"
            tone={apiOnline ? "success" : apiOnline === false ? "danger" : "default"}
            dotTone={apiOnline ? "success" : apiOnline === false ? "danger" : "muted"}
            pulse={!!apiOnline}
            text={apiOnline ? "online" : apiOnline === false ? "offline" : "checking"}
          />
          <StatusPill
            label="MT5"
            tone={connected ? "success" : "warning"}
            dotTone={connected ? "success" : "warning"}
            pulse={connected}
            text={connected ? "connected" : "disconnected"}
          />
          <button
            onClick={copyApi}
            title="Copy API URL"
            className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[11px] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V6a2 2 0 0 1 2-2h9" />
            </svg>
            <span>{apiBase.replace(/^https?:\/\//, "")}</span>
            {copied && <span className="text-[var(--success)]">copied</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

function StatusPill({
  label,
  tone,
  dotTone,
  pulse,
  text,
}: {
  label: string;
  tone: "success" | "danger" | "warning" | "default";
  dotTone: "success" | "danger" | "warning" | "muted";
  pulse: boolean;
  text: string;
}) {
  return (
    <Badge tone={tone}>
      <Dot tone={dotTone} pulse={pulse} />
      <span className="font-semibold tracking-wide">{label}</span>
      <span className="opacity-80">{text}</span>
    </Badge>
  );
}
