"use client";

import { useEffect, useRef } from "react";
import { Badge, Card, Dot } from "@/components/ui";
import { AGENT_ROLES, type AgentRole } from "@/lib/multiAgent";

export type AgentRunStatus = "idle" | "pending" | "streaming" | "done" | "error";

export type AgentRunState = {
  role: AgentRole;
  name?: string;
  provider?: string;
  model?: string;
  status: AgentRunStatus;
  output: string;
  error?: string | null;
};

export function AgentTimeline({ states }: { states: AgentRunState[] }) {
  return (
    <Card
      title="Agent Collaboration"
      subtitle="Live output from each agent in the 3-stage pipeline"
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="6" cy="12" r="2.4" />
          <circle cx="12" cy="12" r="2.4" />
          <circle cx="18" cy="12" r="2.4" />
          <path d="M8.4 12h1.2M14.4 12h1.2" strokeLinecap="round" />
        </svg>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {AGENT_ROLES.map((role) => {
          const state =
            states.find((s) => s.role === role.id) ??
            ({
              role: role.id,
              status: "idle",
              output: "",
              error: null,
            } satisfies AgentRunState);
          return <AgentColumn key={role.id} state={state} />;
        })}
      </div>
    </Card>
  );
}

function AgentColumn({ state }: { state: AgentRunState }) {
  const role = AGENT_ROLES.find((r) => r.id === state.role) ?? AGENT_ROLES[0];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [state.output]);

  const tone =
    state.status === "error"
      ? "danger"
      : state.status === "streaming"
      ? "accent"
      : state.status === "done"
      ? "success"
      : "default";

  const dotTone =
    state.status === "error"
      ? "danger"
      : state.status === "streaming"
      ? "accent"
      : state.status === "done"
      ? "success"
      : "muted";

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80">
      <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${role.iconBg} text-xs font-bold text-white`}
          >
            {role.icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--foreground)]">
              {state.name?.trim() || role.label}
            </div>
            <div className="truncate text-[11px] text-[var(--muted)]">
              {state.provider ? `${state.provider} · ${state.model ?? "—"}` : role.description}
            </div>
          </div>
        </div>
        <Badge tone={tone}>
          <Dot tone={dotTone} pulse={state.status === "streaming"} />
          {state.status}
        </Badge>
      </div>
      <div
        ref={ref}
        className="h-72 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12.5px] leading-6 text-[var(--foreground)]/92"
      >
        {state.output ? (
          <span>{state.output}</span>
        ) : state.status === "error" && state.error ? (
          <span className="text-[var(--danger)]">{state.error}</span>
        ) : (
          <span className="text-[var(--muted)]">
            {state.status === "pending"
              ? "Waiting for the previous agent to finish..."
              : state.status === "streaming"
              ? "Awaiting first token..."
              : "No output yet."}
          </span>
        )}
        {state.status === "streaming" && (
          <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 rounded-sm bg-[var(--accent-2)] animate-blink" />
        )}
      </div>
    </div>
  );
}
