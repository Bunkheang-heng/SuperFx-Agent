"use client";

import { AGENT_ROLES, type AgentRole } from "@/lib/multiAgent";

export type RobotState = "idle" | "thinking" | "speaking" | "done" | "error";

export function RobotAvatar({
  role,
  state,
  size = 56,
}: {
  role: AgentRole;
  state: RobotState;
  size?: number;
}) {
  const roleDef = AGENT_ROLES.find((r) => r.id === role) ?? AGENT_ROLES[0];

  const colors: Record<AgentRole, { body: string; glow: string; eye: string; ring: string }> = {
    analyst: {
      body: "#2563eb",
      glow: "rgba(37,99,235,0.45)",
      eye: "#dbeafe",
      ring: "rgba(37,99,235,0.28)",
    },
    strategist: {
      body: "#7c3aed",
      glow: "rgba(124,58,237,0.45)",
      eye: "#ede9fe",
      ring: "rgba(124,58,237,0.28)",
    },
    risk_manager: {
      body: "#f59e0b",
      glow: "rgba(245,158,11,0.45)",
      eye: "#fef3c7",
      ring: "rgba(245,158,11,0.28)",
    },
    team_lead: {
      body: "#10b981",
      glow: "rgba(16,185,129,0.45)",
      eye: "#d1fae5",
      ring: "rgba(16,185,129,0.28)",
    },
  };

  const c = colors[role];
  const isActive = state === "thinking" || state === "speaking";
  const ringPulse =
    state === "speaking"
      ? "animate-pulse-ring-accent"
      : state === "done"
      ? "animate-pulse-ring-success"
      : "";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      title={`${roleDef.label} - ${state}`}
      aria-label={`${roleDef.label} robot avatar, ${state}`}
    >
      <span
        className={`absolute inset-0 rounded-2xl ${ringPulse}`}
        style={{
          background: c.ring,
          filter: "blur(2px)",
        }}
      />

      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className={`relative z-10 ${isActive ? "animate-robot-bob-active" : "animate-robot-bob"}`}
        style={{ filter: isActive ? `drop-shadow(0 6px 14px ${c.glow})` : undefined }}
      >
        <line x1="32" y1="6" x2="32" y2="14" stroke={c.body} strokeWidth="1.6" strokeLinecap="round" />
        <circle
          cx="32"
          cy="6"
          r="2.4"
          fill={c.body}
          className={isActive ? "animate-robot-antenna" : ""}
          style={{ transformOrigin: "32px 6px" }}
        />

        <rect x="14" y="14" width="36" height="32" rx="9" fill={c.body} />

        <rect x="11" y="26" width="3" height="10" rx="1.5" fill={c.body} opacity="0.85" />
        <rect x="50" y="26" width="3" height="10" rx="1.5" fill={c.body} opacity="0.85" />

        <g fill="rgba(0,0,0,0.18)">
          <rect x="18" y="40" width="28" height="2.5" rx="1.2" />
        </g>

        <g>
          <rect
            x="20"
            y="22"
            width="8"
            height="8"
            rx="2"
            fill="rgba(0,0,0,0.35)"
          />
          <rect
            x="36"
            y="22"
            width="8"
            height="8"
            rx="2"
            fill="rgba(0,0,0,0.35)"
          />
          <circle cx="24" cy="26" r="2.2" fill={c.eye} className="animate-robot-eye" style={{ transformOrigin: "24px 26px" }} />
          <circle cx="40" cy="26" r="2.2" fill={c.eye} className="animate-robot-eye" style={{ transformOrigin: "40px 26px" }} />
        </g>

        {state === "speaking" ? (
          <g transform="translate(24,36)">
            <rect x="0" y="-3" width="2" height="6" rx="1" fill="rgba(255,255,255,0.95)" className="animate-robot-antenna" style={{ animationDuration: "0.7s" }} />
            <rect x="4" y="-4" width="2" height="8" rx="1" fill="rgba(255,255,255,0.95)" className="animate-robot-antenna" style={{ animationDuration: "0.55s" }} />
            <rect x="8" y="-3" width="2" height="6" rx="1" fill="rgba(255,255,255,0.95)" className="animate-robot-antenna" style={{ animationDuration: "0.85s" }} />
            <rect x="12" y="-2" width="2" height="4" rx="1" fill="rgba(255,255,255,0.95)" className="animate-robot-antenna" style={{ animationDuration: "0.65s" }} />
            <rect x="16" y="-3" width="2" height="6" rx="1" fill="rgba(255,255,255,0.95)" className="animate-robot-antenna" style={{ animationDuration: "0.75s" }} />
          </g>
        ) : (
          <rect
            x="26"
            y="36"
            width="12"
            height="2.2"
            rx="1.1"
            fill="rgba(255,255,255,0.7)"
          />
        )}

        <rect x="20" y="46" width="8" height="6" rx="2" fill={c.body} opacity="0.9" />
        <rect x="36" y="46" width="8" height="6" rx="2" fill={c.body} opacity="0.9" />
      </svg>

      {state === "thinking" && (
        <span className="absolute -top-1 -right-1 inline-flex items-center gap-0.5 rounded-full bg-[var(--surface-3)]/90 px-1.5 py-0.5 text-[10px] text-[var(--muted)] shadow-sm">
          <span
            className="inline-block h-1 w-1 rounded-full bg-current"
            style={{ animation: "thinking-dot 1.2s ease-in-out infinite", animationDelay: "0s" }}
          />
          <span
            className="inline-block h-1 w-1 rounded-full bg-current"
            style={{ animation: "thinking-dot 1.2s ease-in-out infinite", animationDelay: "0.18s" }}
          />
          <span
            className="inline-block h-1 w-1 rounded-full bg-current"
            style={{ animation: "thinking-dot 1.2s ease-in-out infinite", animationDelay: "0.36s" }}
          />
        </span>
      )}
    </div>
  );
}
