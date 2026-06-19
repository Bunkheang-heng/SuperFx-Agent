"use client";

import { useEffect, useRef } from "react";
import { Badge, Button, Card, Dot } from "./ui";

export function StreamPanel({
  status,
  tokens,
  streaming,
  onClear,
}: {
  status: string;
  tokens: string;
  streaming: boolean;
  onClear: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [tokens]);

  const tokenCount = tokens.length;
  const lineCount = tokens ? tokens.split(/\r?\n/).length : 0;

  return (
    <Card
      title="Live Stream"
      subtitle="Real-time model output presented in the same execution workspace style."
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 17l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 19h8" strokeLinecap="round" />
        </svg>
      }
      action={
        <div className="flex items-center gap-2">
          <Badge tone={streaming ? "accent" : "default"}>
            <Dot tone={streaming ? "accent" : "muted"} pulse={streaming} />
            {streaming ? "streaming" : "idle"}
          </Badge>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      }
      className="overflow-hidden"
      padded={false}
    >
      <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/75 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Stream State
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
              <Dot tone={streaming ? "accent" : "muted"} pulse={streaming} />
              {streaming ? "Receiving live tokens" : "Waiting for a streamed cycle"}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/75 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Output Size
            </div>
            <div className="mt-1 font-mono text-sm font-medium text-[var(--foreground)]">
              {tokenCount.toLocaleString()} chars
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/75 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Output Lines
            </div>
            <div className="mt-1 font-mono text-sm font-medium text-[var(--foreground)]">
              {lineCount.toLocaleString()} lines
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/65 px-3 py-2 text-xs text-[var(--muted)]">
          <Dot tone={streaming ? "accent" : "muted"} pulse={streaming} />
          <span className="truncate">
            {status || "Start a streamed cycle to inspect the model output as it arrives."}
          </span>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-3)] px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)]/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
                llm stream
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--muted)]">
              <span>{tokenCount.toLocaleString()} chars</span>
              <span className="text-[var(--muted-2)]">/</span>
              <span>{lineCount.toLocaleString()} lines</span>
            </div>
          </div>

          <div
            ref={ref}
            className="h-80 overflow-auto px-4 py-4 font-mono text-[13px] leading-6 text-[var(--foreground)]/92 whitespace-pre-wrap"
          >
            {tokens ? (
              <div className="min-h-full">
                <span>{tokens}</span>
                {streaming && (
                  <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 rounded-sm bg-[var(--accent-2)] animate-blink" />
                )}
              </div>
            ) : (
              <div className="flex h-full min-h-[240px] flex-col items-start justify-center gap-3 text-[var(--muted)]">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 px-3 py-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent-2)]">
                    Stream Ready
                  </div>
                  <div className="mt-1 text-sm text-[var(--foreground)]">
                    Press <span className="font-medium text-[var(--accent-2)]">Start trading</span> to watch the model output in real time.
                  </div>
                </div>
                <div className="font-mono text-xs text-[var(--muted)]/90">
                  The panel will auto-scroll as new tokens arrive.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
