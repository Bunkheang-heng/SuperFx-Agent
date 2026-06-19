"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavTab, NavTabBar } from "@/components/NavTabs";
import { Badge, Button, Card, Dot } from "@/components/ui";
import { DecisionPanel } from "@/components/DecisionPanel";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";
import { AgentConfigCard } from "@/components/multiAgent/AgentConfigCard";
import { PropFirmProgressBanner } from "@/components/multiAgent/PropFirmProgressBanner";
import { StandardDeskTradeSetup } from "@/components/multiAgent/StandardDeskTradeSetup";
import { PropFirmDeskTradeSetup } from "@/components/multiAgent/PropFirmDeskTradeSetup";
import { useMultiAgentDeskSessionOptional } from "@/components/multiAgent/MultiAgentDeskSessionHost";
import { QUICK_SYMBOLS } from "@/components/multiAgent/deskSetupConstants";
import { TradingFloor, type ChatMessage, type AgentLiveStatus } from "@/components/multiAgent/TradingFloor";
import { LivePositionCard, type DecisionLogEntry } from "@/components/multiAgent/LivePositionCard";
import { LivePositionSidebar, LivePositionSidebarTrigger } from "@/components/multiAgent/LivePositionSidebar";
import {
  AGENT_ROLES,
  type AgentRole,
  type BuildPayloadOptions,
  type DeskMode,
  cancelActiveTradingCycle,
  clearStoredConfig,
  defaultConfig,
  loadConfig,
  type LivePosition,
  type MonitorDecision,
  type MultiAgentRunResult,
  type MultiAgentStoredConfig,
  saveConfig,
  streamAutoTrade,
} from "@/lib/multiAgent";
import { type RunCycleResult } from "@/lib/api";
import { slimMultiAgentRunResultForUi } from "@/lib/trimForUi";
import { isPropFirmRulesActive, propFirmRulesSummary } from "@/lib/propFirm";
import { usePropFirmRules } from "@/lib/usePropFirmRules";
import { tradingAccountModeLabel } from "@/lib/tradingAccount";

function emptyLiveStatus(): AgentLiveStatus {
  return {
    analyst: "idle",
    strategist: "idle",
    risk_manager: "idle",
    team_lead: "idle",
  };
}

function formatCycleLabel(kind: "entry" | "monitor", iteration: number): string {
  if (kind === "entry") return "Entry Cycle";
  return `Monitor Cycle #${iteration}`;
}

let _msgIdCounter = 0;
function nextId(prefix: string): string {
  _msgIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_msgIdCounter}`;
}

/** Prevent unbounded RAM growth during long auto-trading / streaming sessions. */
const MAX_CHAT_MESSAGES = 220;
const MAX_DECISION_LOG_ENTRIES = 200;
const MAX_CHAT_BUBBLE_CHARS = 42_000;

function capChatBubbleContent(content: string): string {
  if (content.length <= MAX_CHAT_BUBBLE_CHARS) return content;
  const omitted = content.length - MAX_CHAT_BUBBLE_CHARS;
  return `${content.slice(0, MAX_CHAT_BUBBLE_CHARS)}\n...[truncated ${omitted} characters for UI memory cap]`;
}

function capChatMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_CHAT_MESSAGES) return messages;
  return messages.slice(messages.length - MAX_CHAT_MESSAGES);
}

function capDecisionEntries(entries: DecisionLogEntry[]): DecisionLogEntry[] {
  if (entries.length <= MAX_DECISION_LOG_ENTRIES) return entries;
  return entries.slice(entries.length - MAX_DECISION_LOG_ENTRIES);
}

export type MultiAgentDeskPageProps = {
  variant?: DeskMode;
  /** @deprecated use deskSection */
  initialDeskTab?: "setup" | "floor";
  deskSection?: "setup" | "floor";
  viewMode?: "full" | "floor_only";
  /** Keep SSE streams alive when the component is hidden or portaled (tab/route navigation). */
  disableUnmountStop?: boolean;
  onRuntimeChange?: (isLive: boolean, statusLine: string) => void;
};

export function MultiAgentDeskPage({
  variant = "standard",
  initialDeskTab = "setup",
  deskSection: deskSectionProp,
  viewMode = "full",
  disableUnmountStop = false,
  onRuntimeChange,
}: MultiAgentDeskPageProps) {
  const deskSection = deskSectionProp ?? initialDeskTab;
  const deskSession = useMultiAgentDeskSessionOptional();
  const { status, accountMode, onInfo, onSuccess, onError } = useTradingWorkspace();
  const {
    rules: propFirmRules,
    hydrated: propFirmHydrated,
    activeProfileId,
    saveToDatabase,
    syncing: propFirmSyncing,
  } = usePropFirmRules();
  const isPropFirmDesk = variant === "prop_firm";
  const deskOpts: BuildPayloadOptions = useMemo(
    () => ({
      deskMode: variant,
      accountMode: isPropFirmDesk ? "prop_firm" : accountMode,
      propFirmRules: isPropFirmDesk ? propFirmRules : accountMode === "prop_firm" ? propFirmRules : undefined,
    }),
    [variant, isPropFirmDesk, accountMode, propFirmRules],
  );
  const [config, setConfig] = useState<MultiAgentStoredConfig>(defaultConfig);
  const [hydrated, setHydrated] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [statusLine, setStatusLine] = useState("");
  const [result, setResult] = useState<MultiAgentRunResult | null>(null);
  const [showConfig, setShowConfig] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [liveStatus, setLiveStatus] = useState<AgentLiveStatus>(emptyLiveStatus);
  const [speakingRole, setSpeakingRole] = useState<AgentRole | null>(null);
  const [cycleNumber, setCycleNumber] = useState(0);
  const cycleNumberRef = useRef(0);
  const cycleKindRef = useRef<"entry" | "monitor">("entry");

  const [monitoring, setMonitoring] = useState(false);
  const [monitorIteration, setMonitorIteration] = useState(0);
  const [monitorIntervalSeconds, setMonitorIntervalSeconds] = useState(30);
  const [livePosition, setLivePosition] = useState<LivePosition | null>(null);
  const [lastDecision, setLastDecision] = useState<MonitorDecision | null>(null);
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);
  const [nextReviewAt, setNextReviewAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const stopMonitorRef = useRef<null | (() => void)>(null);
  const stopAutoRef = useRef<null | (() => void)>(null);
  const autoTradingRef = useRef(false);

  const tokenBuffersRef = useRef<Partial<Record<AgentRole, string>>>({});
  const flushRafRef = useRef<number | null>(null);

  const [autoTrading, setAutoTrading] = useState(false);
  const [autoRound, setAutoRound] = useState(0);
  const [autoPhase, setAutoPhase] = useState("");
  const [activeDeskTab, setActiveDeskTab] = useState<"setup" | "floor">(deskSection);
  const [positionSidebarOpen, setPositionSidebarOpen] = useState(false);

  const prevVariantRef = useRef(variant);

  useEffect(() => {
    const variantChanged = prevVariantRef.current !== variant;
    prevVariantRef.current = variant;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfig(loadConfig(variant));
    setMonitorIntervalSeconds(variant === "prop_firm" ? 60 : 30);
    setHydrated(true);
    if (variantChanged) {
      setMessages([]);
      setResult(null);
      setLiveStatus(emptyLiveStatus());
      setSpeakingRole(null);
      setStatusLine("");
    }
  }, [variant]);

  useEffect(() => {
    if (hydrated) saveConfig(config, variant);
  }, [config, hydrated, variant]);

  useEffect(() => {
    if (!monitoring) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [monitoring]);

  useEffect(() => {
    autoTradingRef.current = autoTrading;
  }, [autoTrading]);

  useEffect(() => {
    setActiveDeskTab(deskSection);
  }, [deskSection]);

  const isRuntimeLive = streaming || monitoring || autoTrading;
  const disableUnmountStopRef = useRef(disableUnmountStop);
  const runtimeLiveRef = useRef(isRuntimeLive);

  useEffect(() => {
    disableUnmountStopRef.current = disableUnmountStop;
  }, [disableUnmountStop]);

  useEffect(() => {
    runtimeLiveRef.current = isRuntimeLive;
  }, [isRuntimeLive]);

  useEffect(() => {
    onRuntimeChange?.(isRuntimeLive, statusLine);
  }, [isRuntimeLive, statusLine, onRuntimeChange]);

  useEffect(() => {
    return () => {
      if (disableUnmountStopRef.current && runtimeLiveRef.current) {
        return;
      }
      stopMonitorRef.current?.();
      stopAutoRef.current?.();
      if (flushRafRef.current != null) {
        cancelAnimationFrame(flushRafRef.current);
        flushRafRef.current = null;
      }
    };
  }, []);

  const flushTokenBuffers = useCallback(() => {
    flushRafRef.current = null;
    const chunks: Partial<Record<AgentRole, string>> = {};
    for (const r of AGENT_ROLES) {
      const buf = tokenBuffersRef.current[r.id];
      if (buf && buf.length > 0) {
        chunks[r.id] = buf;
        tokenBuffersRef.current[r.id] = "";
      }
    }
    if (Object.keys(chunks).length === 0) return;
    setMessages((prev) => {
      let next: ChatMessage[] | null = null;
      for (const role of Object.keys(chunks) as AgentRole[]) {
        const chunk = chunks[role];
        if (!chunk) continue;
        for (let i = prev.length - 1; i >= 0; i -= 1) {
          const row = (next ?? prev)[i];
          if (row.role === role && row.status === "streaming") {
            if (!next) next = [...prev];
            next[i] = { ...row, content: capChatBubbleContent(row.content + chunk) };
            break;
          }
        }
      }
      return capChatMessages(next ?? prev);
    });
  }, []);

  const connected = !!status?.connected;
  const ruleSymbols = useMemo(() => {
    const raw = propFirmRules.allowed_symbols ?? "";
    const list = raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(list));
  }, [propFirmRules.allowed_symbols]);
  const useRuleSymbols =
    accountMode === "prop_firm" && isPropFirmDesk && propFirmRules.enabled && ruleSymbols.length > 0;
  const symbolOptions = useMemo(() => {
    const base = useRuleSymbols ? ruleSymbols : [...QUICK_SYMBOLS];
    const current = config.symbol.trim().toUpperCase();
    if (!current) return base;
    if (base.includes(current)) return base;
    return [current, ...base];
  }, [config.symbol, useRuleSymbols, ruleSymbols]);

  useEffect(() => {
    if (!isPropFirmDesk || !useRuleSymbols) return;
    const current = config.symbol.trim().toUpperCase();
    if (current && ruleSymbols.includes(current)) return;
    const first = ruleSymbols[0];
    if (!first) return;
    setConfig((prev) => ({ ...prev, symbol: first }));
  }, [isPropFirmDesk, useRuleSymbols, ruleSymbols, config.symbol]);

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (isPropFirmDesk) {
      if (!propFirmRules.enabled) issues.push("Enable prop firm rules and save to DB");
      if (propFirmRules.profit_target_pct == null || propFirmRules.profit_target_pct <= 0) {
        issues.push("Set a profit target % in prop firm rules (required for evaluation desk)");
      }
      if (!activeProfileId) issues.push("Save prop firm rules to DB before running the desk");
      if (propFirmRules.enabled && ruleSymbols.length === 0) {
        issues.push("Add allowed symbols in prop firm rules (Rules tab)");
      }
    }
    config.agents.forEach((agent) => {
      const label = AGENT_ROLES.find((r) => r.id === agent.role)?.label ?? agent.role;
      if (!agent.api_key.trim()) issues.push(`${label}: API key required`);
      if (!agent.model.trim()) issues.push(`${label}: model id required`);
    });
    if (!config.symbol.trim()) issues.push("Symbol required");
    return issues;
  }, [config, isPropFirmDesk, accountMode, propFirmRules, activeProfileId]);

  const updateAgent = (role: AgentRole, patch: Partial<MultiAgentStoredConfig["agents"][number]>) => {
    setConfig((prev) => ({
      ...prev,
      agents: prev.agents.map((agent) => (agent.role === role ? { ...agent, ...patch } : agent)),
    }));
  };

  const updateField = <K extends keyof MultiAgentStoredConfig>(
    key: K,
    value: MultiAgentStoredConfig[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const setAgentStatus = (role: AgentRole, state: AgentLiveStatus[AgentRole]) => {
    setLiveStatus((prev) => ({ ...prev, [role]: state }));
  };

  const resetForRun = () => {
    tokenBuffersRef.current = {};
    if (flushRafRef.current != null) {
      cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = null;
    }
    setMessages([]);
    setStatusLine("");
    setResult(null);
    setLiveStatus(emptyLiveStatus());
    setSpeakingRole(null);
    cycleNumberRef.current = 0;
    setCycleNumber(0);
    setLivePosition(null);
    setLastDecision(null);
    setDecisionLog([]);
    setMonitorIteration(0);
    setNextReviewAt(null);
  };

  const beginCycle = (kind: "entry" | "monitor", iteration: number) => {
    cycleKindRef.current = kind;
    cycleNumberRef.current += 1;
    setCycleNumber(cycleNumberRef.current);
    if (kind === "monitor") setMonitorIteration(iteration);
    setMessages((prev) =>
      capChatMessages([
        ...prev,
        {
          id: nextId("sys"),
          role: "system",
          cycle: cycleNumberRef.current,
          cycleLabel: formatCycleLabel(kind, iteration),
          status: "info",
          content:
            kind === "entry"
              ? "The team begins reviewing the market"
              : `Cycle #${iteration} - reviewing the open position`,
          timestamp: Date.now(),
        },
      ]),
    );
  };

  const pushAgentStart = (role: AgentRole, provider: string, model: string) => {
    setSpeakingRole(role);
    setAgentStatus(role, "speaking");
    setMessages((prev) =>
      capChatMessages([
        ...prev,
        {
          id: nextId(`agent-${role}`),
          role,
          cycle: cycleNumberRef.current,
          cycleLabel: formatCycleLabel(cycleKindRef.current, monitorIteration || 1),
          status: "streaming",
          content: "",
          meta: `${provider} - ${model}`,
          timestamp: Date.now(),
        },
      ]),
    );
  };

  const appendAgentToken = (role: AgentRole, token: string) => {
    tokenBuffersRef.current[role] = (tokenBuffersRef.current[role] ?? "") + token;
    if (flushRafRef.current == null) {
      flushRafRef.current = requestAnimationFrame(() => flushTokenBuffers());
    }
  };

  const finishAgent = (role: AgentRole, output: string, errorMsg?: string) => {
    const pending = tokenBuffersRef.current[role];
    if (pending) tokenBuffersRef.current[role] = "";
    if (flushRafRef.current != null) {
      cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = null;
    }
    setAgentStatus(role, errorMsg ? "error" : "done");
    if (speakingRole === role) setSpeakingRole(null);
    setMessages((prev) => {
      for (let i = prev.length - 1; i >= 0; i -= 1) {
        if (prev[i].role === role && prev[i].status === "streaming") {
          const copy = [...prev];
          const base = capChatBubbleContent(copy[i].content + (pending ?? ""));
          copy[i] = {
            ...copy[i],
            status: errorMsg ? "error" : "done",
            content: capChatBubbleContent(errorMsg ? errorMsg : output || base),
          };
          return capChatMessages(copy);
        }
      }
      return prev;
    });
  };

  const pushSystem = (content: string, kind: "info" | "error" = "info") => {
    setMessages((prev) =>
      capChatMessages([
        ...prev,
        {
          id: nextId("sys"),
          role: "system",
          cycle: cycleNumberRef.current,
          cycleLabel: formatCycleLabel(cycleKindRef.current, monitorIteration || 1),
          status: kind,
          content,
          timestamp: Date.now(),
        },
      ]),
    );
  };

  const handleStopMonitor = () => {
    stopMonitorRef.current?.();
    stopMonitorRef.current = null;
    setMonitoring(false);
    setNextReviewAt(null);
    pushSystem("Monitoring stopped by user");
    onInfo("Monitoring stopped");
  };

  const handleStopAuto = () => {
    autoTradingRef.current = false;
    void cancelActiveTradingCycle();
    stopAutoRef.current?.();
    stopAutoRef.current = null;
    setAutoTrading(false);
    setStreaming(false);
    setMonitoring(false);
    setNextReviewAt(null);
    setAutoPhase("");
    setLiveStatus(emptyLiveStatus());
    pushSystem("Auto-trading stop requested");
    onInfo("Auto-trading stop requested");
  };

  const handleStartAuto = () => {
    if (!connected) {
      onError("Connect MT5 first.");
      return;
    }
    if (validation.length > 0) {
      onError(validation[0]);
      return;
    }
    if (streaming || monitoring || autoTrading) {
      onError("A run is already in progress.");
      return;
    }
    resetForRun();
    autoTradingRef.current = true;
    setAutoTrading(true);
    setShowConfig(false);
    setAutoRound(0);
    setAutoPhase("starting");

    const monitorHandlers = {
      onPositionUpdate: (data: { iteration: number; position: LivePosition }) => {
        setLivePosition(data.position);
        setMonitorIteration(data.iteration);
        cycleKindRef.current = "monitor";
        beginCycle("monitor", data.iteration);
        setLiveStatus({
          analyst: "thinking",
          strategist: "thinking",
          risk_manager: "thinking",
          team_lead: "thinking",
        });
      },
      onMonitorDecision: (data: {
        iteration: number;
        decision: MonitorDecision;
        execution: Record<string, unknown>;
        position: LivePosition;
      }) => {
        setLastDecision(data.decision);
        setLivePosition(data.position);
        setDecisionLog((prev) =>
          capDecisionEntries([
            ...prev,
            {
              id: nextId("dec"),
              iteration: data.iteration,
              action: data.decision.action,
              reason: data.decision.reason,
              newSl: data.decision.new_stop_loss ?? null,
              newTp: data.decision.new_take_profit ?? null,
              timestamp: Date.now(),
              ok:
                data.decision.action === "hold"
                  ? true
                  : Boolean(
                      (data.execution as { closed?: number; modified?: number; status?: string })?.status &&
                        ["closed", "modified"].includes(
                          String((data.execution as { status?: string }).status),
                        ),
                    ),
            },
          ]),
        );
        if (data.decision.action === "hold") {
          pushSystem(`Team lead: HOLD - ${data.decision.reason}`);
        } else if (data.decision.action === "modify") {
          const parts: string[] = [];
          if (data.decision.new_stop_loss != null)
            parts.push(`SL -> ${Number(data.decision.new_stop_loss).toFixed(5)}`);
          if (data.decision.new_take_profit != null)
            parts.push(`TP -> ${Number(data.decision.new_take_profit).toFixed(5)}`);
          pushSystem(`Team lead: MODIFY (${parts.join(", ")})`);
        } else if (data.decision.action === "close") {
          pushSystem(`Team lead: CLOSE - ${data.decision.reason}`);
        }
        setLiveStatus({
          analyst: "idle",
          strategist: "idle",
          risk_manager: "idle",
          team_lead: "idle",
        });
        setNextReviewAt(Date.now() + monitorIntervalSeconds * 1000);
      },
      onPositionClosed: (data: { iteration: number; reason: string }) => {
        pushSystem(`Position closed (${data.reason})`);
        setLivePosition({ open: false });
      },
    };

    const stop = streamAutoTrade(
      config,
      {
        monitorIntervalSeconds: monitorIntervalSeconds,
        monitorMaxIterations: 100_000,
      },
      {
        onStatus: (data) => setStatusLine(data.message),
        onAutoTradeStarted: () => {
          pushSystem(
            `Auto-trading running: re-scan every ${config.auto_trade_entry_interval_seconds}s when flat; monitor every ${monitorIntervalSeconds}s while in a trade.`,
          );
        },
        onAutoTradeRound: ({ round, phase }) => {
          setAutoRound(round);
          setAutoPhase(phase);
          if (phase === "entry") {
            cycleKindRef.current = "entry";
            beginCycle("entry", round);
            setStreaming(true);
            setMonitoring(false);
            setNextReviewAt(null);
            setLiveStatus({
              analyst: "thinking",
              strategist: "thinking",
              risk_manager: "thinking",
              team_lead: "thinking",
            });
          } else if (phase === "monitor") {
            setStreaming(false);
            setMonitoring(true);
            cycleKindRef.current = "monitor";
          } else if (phase === "cooldown") {
            setStreaming(false);
            setMonitoring(false);
            setNextReviewAt(null);
            setLiveStatus(emptyLiveStatus());
            pushSystem(
              config.auto_trade_entry_interval_seconds > 0
                ? `Flat — next full desk review in ${config.auto_trade_entry_interval_seconds}s`
                : `Flat — starting next desk review immediately`,
            );
          }
        },
        onAgentStart: (data) => {
          pushAgentStart(data.role, data.provider, data.model);
        },
        onAgentToken: (data) => {
          appendAgentToken(data.role, data.token);
        },
        onAgentDone: (data) => {
          finishAgent(data.role, data.output);
        },
      onDone: (data) => {
        setResult(slimMultiAgentRunResultForUi(data));
        setStreaming(false);
          setLiveStatus(emptyLiveStatus());
          const exec = data.execution as { executed?: boolean };
          const dec = data.decision as { reason?: string; stop_loss?: number | null; take_profit?: number | null } | null;
          if (exec?.executed && config.execute && dec) {
            setDecisionLog((prev) =>
              capDecisionEntries([
                ...prev,
                {
                  id: nextId("dec"),
                  iteration: 0,
                  action: "entry",
                  reason: dec.reason ?? "Entry placed",
                  newSl: dec.stop_loss ?? null,
                  newTp: dec.take_profit ?? null,
                  timestamp: Date.now(),
                },
              ]),
            );
            onSuccess("Auto-trading: order executed");
          }
        },
        ...monitorHandlers,
        onMonitorDone: (data) => {
          setMonitoring(false);
          setNextReviewAt(null);
          setLiveStatus(emptyLiveStatus());
          if (!autoTradingRef.current) {
            setStatusLine(
              data.last_action === "close"
                ? "Position closed by team lead"
                : "Monitoring finished",
            );
            onInfo("Monitoring finished");
          } else {
            setStatusLine(
              data.last_action === "close"
                ? "Position closed — auto-trading continues"
                : "Monitor phase ended — auto-trading continues",
            );
          }
        },
        onRecoverableError: (msg, round) => {
          pushSystem(`Round ${round ?? "?"} failed (will retry after cooldown): ${msg}`, "error");
          setStatusLine("Entry cycle error — retrying");
        },
        onAutoTradeDone: (summary) => {
          setAutoTrading(false);
          stopAutoRef.current = null;
          setStreaming(false);
          setMonitoring(false);
          setNextReviewAt(null);
          setAutoPhase("");
          setLiveStatus(emptyLiveStatus());
          const cycles = summary.entry_cycles ?? "?";
          const errs = summary.recoverable_errors ?? 0;
          pushSystem(`Auto-trading session ended (entry cycles: ${cycles}, recoverable errors: ${errs})`);
          onInfo("Auto-trading session ended");
        },
        onCancelled: (message) => {
          setAutoTrading(false);
          stopAutoRef.current = null;
          setStreaming(false);
          setMonitoring(false);
          setNextReviewAt(null);
          setAutoPhase("");
          setLiveStatus(emptyLiveStatus());
          setStatusLine(message);
          pushSystem(message, "info");
          onInfo(message);
        },
        onError: (message) => {
          setAutoTrading(false);
          stopAutoRef.current = null;
          setStreaming(false);
          setMonitoring(false);
          setNextReviewAt(null);
          setAutoPhase("");
          setLiveStatus(emptyLiveStatus());
          if (message.includes("still stopping") || message.includes("already running")) {
            void cancelActiveTradingCycle();
          }
          pushSystem(message, "error");
          onError(message);
        },
      },
      deskOpts,
    );
    stopAutoRef.current = stop;
  };

  const handleSavePropFirmDb = async () => {
    try {
      const profile = await saveToDatabase(
        propFirmRules.firm_name?.trim() || "My prop firm profile",
      );
      onSuccess(`Saved prop firm profile #${profile.id}`);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const handleReset = () => {
    stopAutoRef.current?.();
    stopAutoRef.current = null;
    setAutoTrading(false);
    setAutoPhase("");
    setConfig(defaultConfig(variant));
    clearStoredConfig(variant);
    onInfo(isPropFirmDesk ? "Evaluation desk configuration reset" : "Multi-agent configuration reset");
  };

  const decisionResult: RunCycleResult | null = useMemo(() => {
    if (!result || !result.decision) return null;
    return {
      wait_for_new_candle: config.wait_for_new_candle,
      provider: "multi-agent",
      model: result.agents.map((a) => `${a.role}:${a.provider}/${a.model}`).join(" -> "),
      trading_mode: result.trading_mode,
      trading_strategy: result.trading_strategy,
      symbol: result.symbol,
      snapshot: result.snapshot,
      decision: result.decision as RunCycleResult["decision"],
      execution: result.execution,
    };
  }, [result, config.wait_for_new_candle]);

  const countdownMs =
    monitoring && nextReviewAt != null ? Math.max(0, nextReviewAt - now) : null;

  const headlineKind = autoTrading
    ? `Auto-trading round ${autoRound || "..."}${autoPhase ? ` - ${autoPhase}` : ""}`
    : streaming
      ? "Entry analysis in progress"
      : monitoring
        ? `Monitoring open position - cycle ${monitorIteration}`
        : result
          ? "Cycle complete"
          : "Trading desk standing by";
  const isDeskStandingBy = headlineKind === "Trading desk standing by";
  const tradingFloorSubline = autoTrading
    ? "Runs entry cycles continuously and monitors open trades until you stop or disconnect."
    : monitoring
      ? `Cycle ${cycleNumber} - the team will discuss again in ~${
          countdownMs == null ? "?" : Math.max(0, Math.ceil(countdownMs / 1000))
        }s`
      : streaming
        ? "Tokens streaming live from each agent"
        : "Run a cycle to start the conversation";

  const positionMonitorStop = monitoring
    ? autoTrading
      ? handleStopAuto
      : handleStopMonitor
    : undefined;

  const livePositionSidebarSubtitle = livePosition?.open
    ? `Monitoring ${config.symbol} every ${monitorIntervalSeconds}s`
    : `No open position on ${config.symbol || "symbol"}`;

  const livePositionSidebarBadge = (
    <Badge tone={monitoring ? "accent" : "default"}>
      <Dot tone={monitoring ? "accent" : "muted"} pulse={monitoring} />
      {monitoring ? `Monitoring · cycle #${monitorIteration}` : "Not monitoring"}
    </Badge>
  );

  const livePositionPanel = (
    <LivePositionCard
      embedded
      symbol={config.symbol}
      position={livePosition}
      iteration={monitorIteration}
      intervalSeconds={monitorIntervalSeconds}
      monitoring={monitoring}
      onStop={positionMonitorStop}
      decisionLog={decisionLog}
      lastDecision={lastDecision}
      countdownMs={countdownMs}
    />
  );

  const livePositionSidebar = (
    <LivePositionSidebar
      open={positionSidebarOpen}
      onClose={() => setPositionSidebarOpen(false)}
      subtitle={livePositionSidebarSubtitle}
      badge={livePositionSidebarBadge}
    >
      {livePositionPanel}
    </LivePositionSidebar>
  );

  if (viewMode === "floor_only") {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex justify-end">
          <LivePositionSidebarTrigger
            onClick={() => setPositionSidebarOpen(true)}
            hasOpenPosition={!!livePosition?.open}
            monitoring={monitoring}
          />
        </div>
        <TradingFloor
          messages={messages}
          liveStatus={liveStatus}
          speakingRole={speakingRole}
          isLive={streaming || monitoring || autoTrading}
          headline={isDeskStandingBy ? "Trading Floor" : headlineKind}
          subline={tradingFloorSubline}
        />
        {livePositionSidebar}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge tone={connected ? "success" : "warning"}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[var(--success)]" : "bg-[var(--warning)]"}`} />
          {connected ? "MT5 connected" : "MT5 disconnected"}
        </Badge>
        <Badge tone={isPropFirmDesk || accountMode === "prop_firm" ? "accent" : accountMode === "real" ? "warning" : "info"}>
          {tradingAccountModeLabel(isPropFirmDesk ? "prop_firm" : accountMode)}
          {!isPropFirmDesk && accountMode !== "prop_firm" ? " · no prop firm rules" : ""}
        </Badge>
        {isPropFirmDesk ? (
          <>
            {activeProfileId != null && <Badge tone="info">DB profile #{activeProfileId}</Badge>}
            <Badge tone={isPropFirmRulesActive(propFirmRules) ? "success" : "default"}>
              {propFirmRulesSummary(propFirmRules)}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              disabled={propFirmSyncing || !propFirmHydrated}
              onClick={() => void handleSavePropFirmDb()}
            >
              {propFirmSyncing ? "Saving…" : "Save rules to DB"}
            </Button>
          </>
        ) : null}
        {!isPropFirmDesk && (
          <Link
            href="/prop-firm"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--accent)]"
          >
            Prop firm desk
          </Link>
        )}
        <Button variant="ghost" size="sm" onClick={() => setShowConfig((v) => !v)}>
          {showConfig ? "Hide agent config" : "Show agent config"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Reset config
        </Button>
      </div>

      {isPropFirmDesk && propFirmHydrated && (
        <PropFirmProgressBanner
          progress={result?.evaluation_progress}
          profitTargetPct={propFirmRules.profit_target_pct}
          accountSize={propFirmRules.account_size}
          firmName={propFirmRules.firm_name}
        />
      )}

      {isPropFirmDesk ? (
        <PropFirmDeskTradeSetup
          config={config}
          updateField={updateField}
          monitorIntervalSeconds={monitorIntervalSeconds}
          setMonitorIntervalSeconds={setMonitorIntervalSeconds}
          validation={validation}
          connected={connected}
          autoTrading={autoTrading}
          streaming={streaming}
          monitoring={monitoring}
          statusLine={statusLine}
          onStartAuto={handleStartAuto}
          onStopAuto={handleStopAuto}
          propFirmRules={propFirmRules}
          activeProfileId={activeProfileId}
          symbolOptions={symbolOptions}
          useRuleSymbols={useRuleSymbols}
          rulesReady={isPropFirmRulesActive(propFirmRules)}
          onEditRules={deskSession ? () => deskSession.setPropFirmTab("rules") : undefined}
        />
      ) : (
        <StandardDeskTradeSetup
          config={config}
          updateField={updateField}
          monitorIntervalSeconds={monitorIntervalSeconds}
          setMonitorIntervalSeconds={setMonitorIntervalSeconds}
          validation={validation}
          connected={connected}
          autoTrading={autoTrading}
          streaming={streaming}
          monitoring={monitoring}
          statusLine={statusLine}
          onStartAuto={handleStartAuto}
          onStopAuto={handleStopAuto}
        />
      )}

      <NavTabBar>
        <NavTab active={activeDeskTab === "setup"} onClick={() => setActiveDeskTab("setup")}>
          {isPropFirmDesk ? "API & agents" : "Agent setup"}
        </NavTab>
        <NavTab active={activeDeskTab === "floor"} onClick={() => setActiveDeskTab("floor")}>
          {isPropFirmDesk ? "Live evaluation" : "Trading floor"}
        </NavTab>
      </NavTabBar>

      {activeDeskTab === "setup" && (
        <>
          {showConfig && (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
              {config.agents.map((agent) => (
                <AgentConfigCard
                  key={agent.role}
                  agent={agent}
                  onChange={(next) => updateAgent(agent.role, next)}
                  onInfo={onInfo}
                  onError={onError}
                />
              ))}
            </div>
          )}

          {isDeskStandingBy && (
            <Card
              title={isPropFirmDesk ? "Evaluation desk idle" : "Desk idle"}
              subtitle={isPropFirmDesk ? "Ready for a funded challenge session" : "Ready for a general multi-agent run"}
              icon={
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18M12 3v18" strokeLinecap="round" />
                </svg>
              }
            >
              <p className="text-sm text-[var(--muted)]">
                {isPropFirmDesk
                  ? "Connect agent API keys, confirm your saved rules profile, then start the evaluation desk."
                  : "Connect agent API keys and run configuration above, then start auto-trading."}
              </p>
            </Card>
          )}
        </>
      )}

      {activeDeskTab === "floor" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              Agent conversation and team-lead decisions appear below.
            </p>
            <LivePositionSidebarTrigger
              onClick={() => setPositionSidebarOpen(true)}
              hasOpenPosition={!!livePosition?.open}
              monitoring={monitoring}
            />
          </div>
          <TradingFloor
            messages={messages}
            liveStatus={liveStatus}
            speakingRole={speakingRole}
            isLive={streaming || monitoring || autoTrading}
            headline={isDeskStandingBy ? "Trading Floor" : headlineKind}
            subline={tradingFloorSubline}
          />
          {livePositionSidebar}
          {!isPropFirmDesk && <DecisionPanel result={decisionResult} />}
        </>
      )}
    </div>
  );
}
