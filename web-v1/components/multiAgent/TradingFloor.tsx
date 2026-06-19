"use client";

import { useEffect, useMemo, useRef } from "react";
import { Badge, Card, Dot } from "@/components/ui";
import { AGENT_ROLES, type AgentRole } from "@/lib/multiAgent";
import { RobotAvatar, type RobotState } from "./RobotAvatar";
import { TradingOfficeScene } from "./TradingOfficeScene";

export type ChatRole = AgentRole | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  cycle: number;
  cycleLabel: string;
  status: "streaming" | "done" | "error" | "info";
  content: string;
  meta?: string;
  timestamp: number;
};

export type AgentLiveStatus = Record<AgentRole, RobotState>;

const AGENT_SIDE: Record<AgentRole, "left" | "right"> = {
  analyst: "left",
  strategist: "right",
  risk_manager: "left",
  team_lead: "right",
};

const PIPELINE: AgentRole[] = ["analyst", "strategist", "risk_manager", "team_lead"];

function replyHint(role: AgentRole, priorRole: AgentRole | null): string | null {
  if (!priorRole) return null;
  const prior = AGENT_ROLES.find((r) => r.id === priorRole)?.label ?? priorRole;
  return `Building on ${prior}`;
}

export function TradingFloor({
  messages,
  liveStatus,
  speakingRole,
  isLive,
  headline,
  subline,
}: {
  messages: ChatMessage[];
  liveStatus: AgentLiveStatus;
  speakingRole: AgentRole | null;
  isLive: boolean;
  headline?: string;
  subline?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const groupedByCycle = useMemo(() => {
    const groups: { cycle: number; cycleLabel: string; items: ChatMessage[] }[] = [];
    for (const msg of messages) {
      const last = groups[groups.length - 1];
      if (last && last.cycle === msg.cycle) {
        last.items.push(msg);
      } else {
        groups.push({ cycle: msg.cycle, cycleLabel: msg.cycleLabel, items: [msg] });
      }
    }
    return groups;
  }, [messages]);

  return (
    <Card
      title={headline ?? "Trading Floor"}
      subtitle={subline ?? "Your AI trading desk — agents collaborate in the war room, then debrief below"}
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 18h16M6 18V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v10" strokeLinecap="round" />
          <circle cx="9" cy="11" r="1.4" />
          <circle cx="15" cy="11" r="1.4" />
        </svg>
      }
      action={
        <Badge tone={isLive ? "accent" : "default"}>
          <Dot tone={isLive ? "accent" : "muted"} pulse={isLive} />
          {isLive ? "live" : "idle"}
        </Badge>
      }
      padded={false}
    >
      <TradingOfficeScene
        messages={messages}
        liveStatus={liveStatus}
        speakingRole={speakingRole}
        isLive={isLive}
      />

      <div className="border-b border-[var(--border)] bg-[var(--surface-2)]/50 px-5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Team transcript
        </p>
      </div>

      <div
        ref={scrollRef}
        className="trading-floor-transcript max-h-[520px] min-h-[300px] overflow-y-auto px-4 py-5 sm:px-5"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex gap-3 opacity-60">
              {AGENT_ROLES.map((role) => (
                <RobotAvatar key={role.id} role={role.id} state="idle" size={40} />
              ))}
            </div>
            <p className="text-sm text-[var(--muted)]">
              The trading office is quiet — press Start auto-trading to bring the team online.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groupedByCycle.map((group, idx) => (
              <CycleBlock key={`${group.cycle}-${idx}`} label={group.cycleLabel} items={group.items} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function CycleBlock({ label, items }: { label: string; items: ChatMessage[] }) {
  let lastAgent: AgentRole | null = null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          {label}
        </span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="flex flex-col gap-4">
        {items.map((msg, i) => {
          const hint =
            msg.role !== "system" && PIPELINE.includes(msg.role as AgentRole)
              ? replyHint(msg.role as AgentRole, lastAgent)
              : null;
          if (msg.role !== "system" && PIPELINE.includes(msg.role as AgentRole)) {
            lastAgent = msg.role as AgentRole;
          }
          return (
            <ChatBubble key={msg.id} msg={msg} staggerIndex={i} replyHint={hint} />
          );
        })}
      </div>
    </div>
  );
}

function ChatBubble({
  msg,
  staggerIndex,
  replyHint: hint,
}: {
  msg: ChatMessage;
  staggerIndex: number;
  replyHint: string | null;
}) {
  if (msg.role === "system") {
    return (
      <div
        className="animate-chat-pop mx-auto flex max-w-[90%] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)]/80 px-3 py-1.5 text-[11px] text-[var(--muted)]"
        style={{ animationDelay: `${Math.min(staggerIndex * 0.04, 0.2)}s` }}
      >
        <Dot tone={msg.status === "error" ? "danger" : "accent"} pulse={msg.status === "streaming"} />
        <span>{msg.content}</span>
      </div>
    );
  }

  const role = AGENT_ROLES.find((r) => r.id === msg.role) ?? AGENT_ROLES[0];
  const side = AGENT_SIDE[role.id];
  const robotState: RobotState =
    msg.status === "streaming" ? "speaking" : msg.status === "error" ? "error" : "done";
  const isRight = side === "right";

  return (
    <div
      className={`animate-chat-pop flex items-end gap-2 sm:gap-3 ${
        isRight ? "flex-row-reverse" : "flex-row"
      }`}
      style={{ animationDelay: `${Math.min(staggerIndex * 0.05, 0.25)}s` }}
    >
      <div className={`shrink-0 ${msg.status === "streaming" ? "animate-robot-bob-active" : ""}`}>
        <RobotAvatar role={role.id} state={robotState} size={48} />
      </div>
      <div className={`min-w-0 max-w-[min(100%,28rem)] flex-1 ${isRight ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`mb-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)] ${
            isRight ? "justify-end" : ""
          }`}
        >
          <span className="font-semibold text-[var(--foreground)]">{role.label}</span>
          {hint && <span className="text-[10px] italic text-[var(--accent)]/90">{hint}</span>}
          {msg.meta && <span className="truncate opacity-80">{msg.meta}</span>}
          {msg.status === "streaming" && (
            <Badge tone="accent">
              <Dot tone="accent" pulse />
              speaking
            </Badge>
          )}
          {msg.status === "error" && (
            <Badge tone="danger">
              <Dot tone="danger" />
              error
            </Badge>
          )}
        </div>
        <div
          className={`chat-bubble-tail relative rounded-2xl border px-4 py-3 text-[13px] leading-6 whitespace-pre-wrap ${
            isRight ? "chat-bubble-tail-right" : "chat-bubble-tail-left"
          } ${
            msg.status === "error"
              ? "border-[color-mix(in_oklab,var(--danger),transparent_55%)] bg-[color-mix(in_oklab,var(--danger),transparent_88%)] text-[var(--danger)]"
              : msg.status === "streaming"
                ? "border-[var(--accent)]/35 bg-[var(--surface-2)] text-[var(--foreground)]/95 shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent),transparent_75%)]"
                : "border-[var(--border)] bg-[var(--surface-2)]/90 text-[var(--foreground)]/95"
          }`}
        >
          {msg.content || (
            <span className="text-[var(--muted)]">Awaiting first token…</span>
          )}
          {msg.status === "streaming" && (
            <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 rounded-sm bg-[var(--accent-2)] animate-blink" />
          )}
        </div>
      </div>
    </div>
  );
}
