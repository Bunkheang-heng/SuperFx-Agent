"use client";

import { useMemo } from "react";
import { AGENT_ROLES, type AgentRole } from "@/lib/multiAgent";
import { RobotAvatar, type RobotState } from "./RobotAvatar";
import type { AgentLiveStatus, ChatMessage } from "./TradingFloor";

const AGENT_COORDS: Record<AgentRole, { x: number; y: number }> = {
  analyst: { x: 17, y: 26 },
  strategist: { x: 83, y: 26 },
  risk_manager: { x: 17, y: 74 },
  team_lead: { x: 83, y: 74 },
};

const PIPELINE: AgentRole[] = ["analyst", "strategist", "risk_manager", "team_lead"];

function previewText(text: string, max = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function useOfficeFlow(messages: ChatMessage[], speakingRole: AgentRole | null) {
  return useMemo(() => {
    const lastCycle = messages.length ? messages[messages.length - 1].cycle : 0;
    const inCycle = messages.filter(
      (m) => m.cycle === lastCycle && m.role !== "system" && PIPELINE.includes(m.role as AgentRole),
    );
    const sequence: AgentRole[] = [];
    for (const m of inCycle) {
      const role = m.role as AgentRole;
      if (sequence[sequence.length - 1] !== role) sequence.push(role);
    }
    const activeLink =
      sequence.length >= 2
        ? { from: sequence[sequence.length - 2], to: sequence[sequence.length - 1] }
        : speakingRole && sequence.length === 1 && sequence[0] === speakingRole
          ? {
              from: PIPELINE[Math.max(0, PIPELINE.indexOf(speakingRole) - 1)],
              to: speakingRole,
            }
          : null;
    const streamingByRole: Partial<Record<AgentRole, string>> = {};
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.role === "system") continue;
      const role = m.role as AgentRole;
      if (!PIPELINE.includes(role) || streamingByRole[role]) continue;
      if (m.status === "streaming" || m.content) {
        streamingByRole[role] = m.content;
      }
    }
    return { sequence, activeLink, streamingByRole, lastCycle };
  }, [messages, speakingRole]);
}

function OfficeLink({
  from,
  to,
  active,
}: {
  from: AgentRole;
  to: AgentRole;
  active: boolean;
}) {
  const a = AGENT_COORDS[from];
  const b = AGENT_COORDS[to];
  return (
    <line
      x1={`${a.x}%`}
      y1={`${a.y}%`}
      x2={`${b.x}%`}
      y2={`${b.y}%`}
      className={active ? "office-link-active" : "office-link-idle"}
    />
  );
}

function DeskStation({
  role,
  label,
  state,
  speaking,
  isLive,
  bubbleText,
  bubbleStreaming,
}: {
  role: AgentRole;
  label: string;
  state: RobotState;
  speaking: boolean;
  isLive: boolean;
  bubbleText?: string;
  bubbleStreaming?: boolean;
}) {
  const busy = state === "thinking" || state === "speaking";
  const showBubble = speaking || busy || Boolean(bubbleText);

  return (
    <div
      className={`trading-desk relative flex flex-col items-center transition duration-300 ${
        speaking ? "trading-desk-speaking z-20" : busy ? "trading-desk-busy z-10" : "z-0"
      }`}
    >
      {showBubble && (
        <div
          className={`office-speech-bubble absolute bottom-[calc(100%+6px)] left-1/2 z-30 w-[min(11.5rem,38vw)] -translate-x-1/2 ${
            bubbleStreaming ? "office-speech-bubble-live" : ""
          }`}
        >
          <p className="line-clamp-3 text-[10px] leading-snug text-[var(--foreground)]/95">
            {bubbleText
              ? previewText(bubbleText)
              : state === "thinking"
                ? "Reviewing data…"
                : state === "speaking"
                  ? "On the call…"
                  : "…"}
          </p>
          {bubbleStreaming && (
            <span className="mt-1 inline-flex gap-0.5">
              <span className="office-typing-dot" style={{ animationDelay: "0s" }} />
              <span className="office-typing-dot" style={{ animationDelay: "0.15s" }} />
              <span className="office-typing-dot" style={{ animationDelay: "0.3s" }} />
            </span>
          )}
        </div>
      )}

      <div className="trading-desk-surface relative flex w-full flex-col items-center gap-1.5 px-2 pb-2 pt-2">
        <div
          className={`trading-desk-monitor relative h-7 w-[88%] overflow-hidden rounded border border-[var(--border)] bg-[#060d18] ${
            busy && isLive ? "trading-desk-monitor-on" : ""
          }`}
        >
          <div className="absolute inset-0 flex items-end gap-px px-1 pb-0.5 opacity-70">
            {[3, 5, 2, 6, 4, 7, 3, 5, 4, 6].map((h, i) => (
              <span
                key={i}
                className={`flex-1 rounded-t-sm bg-[var(--brand-green)]/80 ${
                  busy && isLive ? "office-chart-bar" : "opacity-30"
                }`}
                style={{ height: `${h * 10}%`, animationDelay: `${i * 0.08}s` }}
              />
            ))}
          </div>
          {busy && isLive && <span className="office-monitor-scan" />}
        </div>

        <RobotAvatar role={role} state={state} size={speaking ? 72 : 64} />

        <div className="w-full text-center">
          <div className="text-[11px] font-semibold text-[var(--foreground)]">{label}</div>
          <div
            className={`text-[9px] font-medium uppercase tracking-wider ${
              speaking ? "text-[var(--accent)]" : "text-[var(--muted)]"
            }`}
          >
            {state}
          </div>
        </div>
      </div>

      {speaking && <span className="trading-desk-spotlight" aria-hidden />}
    </div>
  );
}

export function TradingOfficeScene({
  messages,
  liveStatus,
  speakingRole,
  isLive,
}: {
  messages: ChatMessage[];
  liveStatus: AgentLiveStatus;
  speakingRole: AgentRole | null;
  isLive: boolean;
}) {
  const { sequence, activeLink, streamingByRole } = useOfficeFlow(messages, speakingRole);

  const hubPulse = isLive && (speakingRole != null || sequence.length > 0);

  return (
    <div className="trading-office-scene relative overflow-hidden border-b border-[var(--border)]">
      <div className="trading-office-backdrop absolute inset-0" aria-hidden />
      <div className="trading-office-ticker absolute inset-x-0 top-0 flex gap-6 overflow-hidden py-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]/80">
        <span className="office-ticker-track whitespace-nowrap">
          Desk sync · MT5 · Multi-agent pipeline · Analyst → Strategist → Risk → Team Lead · Live collaboration
        </span>
      </div>

      <div className="relative px-4 pb-5 pt-9 sm:px-6">
        <svg
          className="pointer-events-none absolute inset-4 z-0 h-[calc(100%-2.5rem)] w-[calc(100%-2rem)]"
          preserveAspectRatio="none"
          aria-hidden
        >
          {PIPELINE.map((role, i) => {
            if (i === 0) return null;
            const from = PIPELINE[i - 1];
            const to = role;
            const isActive =
              activeLink?.from === from && activeLink?.to === to;
            const isPast = sequence.indexOf(to) >= 0 && sequence.indexOf(from) >= 0;
            return (
              <OfficeLink
                key={`${from}-${to}`}
                from={from}
                to={to}
                active={isActive || (isLive && isPast && hubPulse)}
              />
            );
          })}
          <line
            x1="50%"
            y1="50%"
            x2={`${AGENT_COORDS.analyst.x}%`}
            y2={`${AGENT_COORDS.analyst.y}%`}
            className={hubPulse ? "office-link-hub" : "office-link-idle"}
          />
          <line
            x1="50%"
            y1="50%"
            x2={`${AGENT_COORDS.strategist.x}%`}
            y2={`${AGENT_COORDS.strategist.y}%`}
            className={hubPulse ? "office-link-hub" : "office-link-idle"}
          />
          <line
            x1="50%"
            y1="50%"
            x2={`${AGENT_COORDS.risk_manager.x}%`}
            y2={`${AGENT_COORDS.risk_manager.y}%`}
            className={hubPulse ? "office-link-hub" : "office-link-idle"}
          />
          <line
            x1="50%"
            y1="50%"
            x2={`${AGENT_COORDS.team_lead.x}%`}
            y2={`${AGENT_COORDS.team_lead.y}%`}
            className={hubPulse ? "office-link-hub" : "office-link-idle"}
          />
        </svg>

        <div className="relative z-10 grid min-h-[280px] grid-cols-[1fr_auto_1fr] grid-rows-[1fr_auto_1fr] gap-x-2 gap-y-3 sm:min-h-[320px] sm:gap-x-4">
          <div className="col-start-1 row-start-1 flex items-end justify-center pb-1">
            <DeskStation
              role="analyst"
              label="Analyst"
              state={liveStatus.analyst ?? "idle"}
              speaking={speakingRole === "analyst"}
              isLive={isLive}
              bubbleText={streamingByRole.analyst}
              bubbleStreaming={speakingRole === "analyst"}
            />
          </div>
          <div className="col-start-3 row-start-1 flex items-end justify-center pb-1">
            <DeskStation
              role="strategist"
              label="Strategist"
              state={liveStatus.strategist ?? "idle"}
              speaking={speakingRole === "strategist"}
              isLive={isLive}
              bubbleText={streamingByRole.strategist}
              bubbleStreaming={speakingRole === "strategist"}
            />
          </div>

          <div className="col-start-2 row-start-2 flex flex-col items-center justify-center px-2">
            <div
              className={`trading-office-hub flex flex-col items-center gap-1 rounded-2xl border px-4 py-3 text-center ${
                hubPulse ? "trading-office-hub-live" : ""
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                War room
              </span>
              <span className="text-xs font-semibold text-[var(--foreground)]">
                {isLive ? "Team in session" : "Standing by"}
              </span>
              {sequence.length > 0 && (
                <span className="max-w-[10rem] text-[10px] leading-tight text-[var(--muted)]">
                  {sequence.map((r) => AGENT_ROLES.find((a) => a.id === r)?.label ?? r).join(" → ")}
                </span>
              )}
            </div>
          </div>

          <div className="col-start-1 row-start-3 flex items-start justify-center pt-1">
            <DeskStation
              role="risk_manager"
              label="Risk Manager"
              state={liveStatus.risk_manager ?? "idle"}
              speaking={speakingRole === "risk_manager"}
              isLive={isLive}
              bubbleText={streamingByRole.risk_manager}
              bubbleStreaming={speakingRole === "risk_manager"}
            />
          </div>
          <div className="col-start-3 row-start-3 flex items-start justify-center pt-1">
            <DeskStation
              role="team_lead"
              label="Team Lead"
              state={liveStatus.team_lead ?? "idle"}
              speaking={speakingRole === "team_lead"}
              isLive={isLive}
              bubbleText={streamingByRole.team_lead}
              bubbleStreaming={speakingRole === "team_lead"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
