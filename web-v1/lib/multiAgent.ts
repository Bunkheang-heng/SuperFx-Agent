import { getApiBaseUrl, type RunCycleResult, type TradingMode, type TradingStrategy } from "./api";
import { defaultPropFirmRules, loadPropFirmRules, propFirmRulesForApi, type PropFirmRules } from "./propFirm";
import { getStoredActiveProfileId } from "./profilesApi";
import type { TradingAccountMode } from "./tradingAccount";

function formatStreamHttpError(status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as { detail?: string };
    if (parsed.detail) return parsed.detail;
  } catch {
    /* ignore */
  }
  if (status === 409) {
    return "A trading cycle is still stopping. Press Stop, wait a few seconds, then run again.";
  }
  return `${status} ${text || "request failed"}`.trim();
}

/** Tell the API to stop the active cycle and release the server run lock. */
export async function cancelActiveTradingCycle(): Promise<void> {
  try {
    await fetch(`${getApiBaseUrl()}/api/multi-agent/cancel`, { method: "POST" });
  } catch {
    /* ignore network errors on cancel */
  }
}

export type DeskMode = "standard" | "prop_firm";

export type AgentRole = "analyst" | "strategist" | "risk_manager" | "team_lead";
export type AgentProvider = "openai" | "gemini" | "sealion" | "openai_compatible";

export type AgentConfig = {
  role: AgentRole;
  name?: string;
  provider: AgentProvider;
  api_key: string;
  model: string;
  base_url?: string;
  system_prompt?: string;
  /** Extra playbook appended to this agent's system prompt (built-in role or override). */
  skills?: string;
  temperature?: number;
};

export type MultiAgentRunRequest = {
  agents: AgentConfig[];
  symbol: string;
  wait_for_new_candle: boolean;
  trading_mode: TradingMode;
  trading_strategy: TradingStrategy;
  user_prompt?: string;
  account_mode?: TradingAccountMode;
  prop_firm_rules?: PropFirmRules;
  prop_firm_profile_id?: number;
  desk_mode?: DeskMode;
  execute: boolean;
};

export type AgentRunOutput = {
  role: AgentRole;
  name?: string | null;
  provider: string;
  model: string;
  prompt: string;
  output: string;
  error?: string | null;
};

export type EvaluationProgress = {
  balance?: number | null;
  equity?: number | null;
  baseline_balance?: number | null;
  profit_pct?: number | null;
  profit_target_pct?: number | null;
  progress_to_target_pct?: number | null;
  remaining_to_target_pct?: number | null;
  target_met?: boolean;
  daily_loss_pct?: number | null;
  max_daily_loss_pct?: number | null;
  drawdown_pct?: number | null;
  max_drawdown_pct?: number | null;
};

export type MultiAgentRunResult = {
  symbol: string;
  trading_mode: TradingMode;
  trading_strategy: TradingStrategy;
  snapshot: Record<string, unknown>;
  agents: AgentRunOutput[];
  decision: RunCycleResult["decision"] | null;
  execution: Record<string, unknown>;
  exit_feedback: Record<string, unknown> | null;
  executed: boolean;
  evaluation_progress?: EvaluationProgress | null;
  desk_mode?: DeskMode;
  compliance?: Record<string, unknown> | null;
  run_id?: number | null;
};

export type MultiAgentRunResponse = {
  success: boolean;
  message: string;
  result: MultiAgentRunResult;
};

export type AgentHealthCheckResponse = {
  success: boolean;
  provider: string;
  model: string;
  sample?: string | null;
  error?: string | null;
};

export const AGENT_ROLES: { id: AgentRole; label: string; description: string; iconBg: string; icon: string }[] = [
  {
    id: "analyst",
    label: "Analyst",
    description: "Reads the snapshot and produces a structured market read.",
    iconBg: "bg-[#1e9ee8]",
    icon: "A",
  },
  {
    id: "strategist",
    label: "Strategist",
    description: "Designs candidate trade setups using the analyst's report.",
    iconBg: "bg-[#0b4f8f]",
    icon: "S",
  },
  {
    id: "risk_manager",
    label: "Risk Manager",
    description: "Stress-tests setups and produces a risk review for the team lead.",
    iconBg: "bg-[#f59e0b]",
    icon: "R",
  },
  {
    id: "team_lead",
    label: "Team Lead",
    description: "Final decider. Synthesizes all reports and outputs the trade JSON.",
    iconBg: "bg-[#6bc92a]",
    icon: "T",
  },
];

export type ProviderModelOption = { id: string; label: string; hint?: string };

export const PROVIDER_OPTIONS: {
  id: AgentProvider;
  label: string;
  hint: string;
  defaultBaseUrl?: string;
  defaultModel?: string;
  baseUrlEditable: boolean;
  models: ProviderModelOption[];
  allowCustomModel: boolean;
}[] = [
  {
    id: "openai",
    label: "OpenAI",
    hint: "GPT family via the official chat-completions API.",
    defaultModel: "gpt-4o-mini",
    baseUrlEditable: true,
    defaultBaseUrl: "https://api.openai.com/v1/chat/completions",
    allowCustomModel: true,
    models: [
      { id: "gpt-4o-mini", label: "gpt-4o-mini", hint: "Fast and cheap, good default" },
      { id: "gpt-4o", label: "gpt-4o", hint: "Stronger reasoning" },
      { id: "gpt-4.1-nano", label: "gpt-4.1-nano", hint: "Cheapest GPT-4.1 tier" },
      { id: "gpt-4.1-mini", label: "gpt-4.1-mini", hint: "Balanced GPT-4.1 tier" },
      { id: "gpt-4.1", label: "gpt-4.1", hint: "Top GPT-4.1 tier" },
      { id: "o4-mini", label: "o4-mini", hint: "Reasoning, fast" },
      { id: "o3-mini", label: "o3-mini", hint: "Reasoning, fast" },
      { id: "o1-mini", label: "o1-mini", hint: "Reasoning, lightweight" },
      { id: "o1", label: "o1", hint: "Strong reasoning" },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    hint: "Google AI generative API. Pick a Gemini model.",
    defaultModel: "gemini-2.5-flash",
    baseUrlEditable: true,
    allowCustomModel: true,
    models: [
      { id: "gemini-2.5-flash", label: "gemini-2.5-flash", hint: "Fast and cheap, recommended" },
      { id: "gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite", hint: "Cheapest 2.5 tier" },
      { id: "gemini-2.5-pro", label: "gemini-2.5-pro", hint: "Strongest reasoning" },
      { id: "gemini-2.0-flash", label: "gemini-2.0-flash" },
      { id: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite" },
      { id: "gemini-1.5-pro", label: "gemini-1.5-pro" },
      { id: "gemini-1.5-flash", label: "gemini-1.5-flash" },
    ],
  },
  {
    id: "sealion",
    label: "SeaLion",
    hint: "Southeast-Asia optimized OpenAI-compatible API.",
    defaultModel: "aisingapore/Llama-SEA-LION-v3.5-70B-R",
    defaultBaseUrl: "https://api.sea-lion.ai/v1/chat/completions",
    baseUrlEditable: true,
    allowCustomModel: true,
    models: [
      {
        id: "aisingapore/Llama-SEA-LION-v3.5-70B-R",
        label: "Llama-SEA-LION-v3.5-70B-R",
        hint: "Strongest, default",
      },
      {
        id: "aisingapore/Llama-SEA-LION-v3.5-8B-R",
        label: "Llama-SEA-LION-v3.5-8B-R",
        hint: "Smaller, faster",
      },
      {
        id: "aisingapore/Gemma-SEA-LION-v3-9B-IT",
        label: "Gemma-SEA-LION-v3-9B-IT",
        hint: "Gemma-based",
      },
    ],
  },
  {
    id: "openai_compatible",
    label: "OpenAI-compatible",
    hint: "Any OpenAI-compatible /chat/completions endpoint (Groq, Together, custom, etc).",
    baseUrlEditable: true,
    allowCustomModel: true,
    models: [],
  },
];

export function findProviderOption(id: AgentProvider) {
  return PROVIDER_OPTIONS.find((p) => p.id === id) ?? PROVIDER_OPTIONS[0];
}

const LEGACY_STORAGE_KEY = "thinktrade.multiAgent.config.v1";
const STORAGE_KEY_STANDARD = "thinktrade.multiAgent.config.standard.v1";
const STORAGE_KEY_PROP_FIRM = "thinktrade.multiAgent.config.prop_firm.v1";

export function configStorageKey(deskMode: DeskMode = "standard"): string {
  return deskMode === "prop_firm" ? STORAGE_KEY_PROP_FIRM : STORAGE_KEY_STANDARD;
}

export type MultiAgentStoredConfig = {
  agents: AgentConfig[];
  symbol: string;
  wait_for_new_candle: boolean;
  trading_mode: TradingMode;
  trading_strategy: TradingStrategy;
  user_prompt: string;
  prop_firm_rules: PropFirmRules;
  execute: boolean;
  /** Seconds to wait after a flat entry cycle before the next full desk review (auto-trading). */
  auto_trade_entry_interval_seconds: number;
};

export function defaultAgents(): AgentConfig[] {
  const openai = findProviderOption("openai");
  return AGENT_ROLES.map((role) => ({
    role: role.id,
    name: role.label,
    provider: "openai" as AgentProvider,
    api_key: "",
    model: openai.defaultModel ?? "gpt-4o-mini",
    base_url: openai.defaultBaseUrl ?? "",
    system_prompt: "",
    skills: "",
    temperature: 0.1,
  }));
}

export function defaultConfig(deskMode: DeskMode = "standard"): MultiAgentStoredConfig {
  const base: MultiAgentStoredConfig = {
    agents: defaultAgents(),
    symbol: deskMode === "prop_firm" ? "" : "XAUUSDm",
    wait_for_new_candle: true,
    trading_mode: "auto",
    trading_strategy: "none",
    user_prompt: "",
    prop_firm_rules: defaultPropFirmRules(),
    execute: true,
    auto_trade_entry_interval_seconds: deskMode === "prop_firm" ? 120 : 120,
  };
  return base;
}

function parseStoredConfig(raw: string, deskMode: DeskMode): MultiAgentStoredConfig {
  const parsed = JSON.parse(raw) as Partial<MultiAgentStoredConfig>;
  const base = defaultConfig(deskMode);
    const agents = AGENT_ROLES.map((role) => {
      const existing = parsed.agents?.find((a) => a?.role === role.id);
      if (!existing) return base.agents.find((a) => a.role === role.id)!;
      return {
        role: role.id,
        name: existing.name ?? role.label,
        provider: (existing.provider ?? "openai") as AgentProvider,
        api_key: existing.api_key ?? "",
        model: existing.model ?? "",
        base_url: existing.base_url ?? "",
        system_prompt: existing.system_prompt ?? "",
        skills: existing.skills ?? "",
        temperature: existing.temperature ?? 0.1,
      } satisfies AgentConfig;
    });
    const ei = parsed.auto_trade_entry_interval_seconds;
    const execute = deskMode === "prop_firm" ? true : (parsed.execute ?? base.execute);
    return {
      agents,
      symbol: parsed.symbol ?? base.symbol,
      wait_for_new_candle: parsed.wait_for_new_candle ?? base.wait_for_new_candle,
      trading_mode: (parsed.trading_mode ?? base.trading_mode) as TradingMode,
      trading_strategy: (parsed.trading_strategy ?? base.trading_strategy) as TradingStrategy,
      user_prompt: parsed.user_prompt ?? "",
      prop_firm_rules: parsed.prop_firm_rules
        ? { ...defaultPropFirmRules(), ...parsed.prop_firm_rules }
        : base.prop_firm_rules,
      execute,
      auto_trade_entry_interval_seconds:
        typeof ei === "number" && Number.isFinite(ei) ? Math.min(7200, Math.max(0, Math.round(ei))) : base.auto_trade_entry_interval_seconds,
    };
}

export function loadConfig(deskMode: DeskMode = "standard"): MultiAgentStoredConfig {
  if (typeof window === "undefined") return defaultConfig(deskMode);
  try {
    const key = configStorageKey(deskMode);
    let raw = window.localStorage.getItem(key);
    if (!raw && deskMode === "standard") {
      raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const migrated = parseStoredConfig(raw, deskMode);
        saveConfig(migrated, deskMode);
        return migrated;
      }
    }
    if (!raw) return defaultConfig(deskMode);
    return parseStoredConfig(raw, deskMode);
  } catch {
    return defaultConfig(deskMode);
  }
}

export function saveConfig(config: MultiAgentStoredConfig, deskMode: DeskMode = "standard"): void {
  if (typeof window === "undefined") return;
  try {
    const toSave =
      deskMode === "prop_firm" ? { ...config, execute: true } : config;
    window.localStorage.setItem(configStorageKey(deskMode), JSON.stringify(toSave));
  } catch {
    /* ignore quota errors */
  }
}

export function clearStoredConfig(deskMode: DeskMode = "standard"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(configStorageKey(deskMode));
  } catch {
    /* ignore */
  }
}

export type BuildPayloadOptions = {
  deskMode?: DeskMode;
  propFirmRules?: PropFirmRules;
  accountMode?: TradingAccountMode;
};

function buildPayload(config: MultiAgentStoredConfig, options?: BuildPayloadOptions): MultiAgentRunRequest {
  const deskMode = options?.deskMode ?? "standard";
  const accountMode = options?.accountMode ?? "real";
  let apiRules: PropFirmRules | undefined;
  let profileId: number | undefined;
  if (accountMode === "prop_firm") {
    const propRules =
      options?.propFirmRules ??
      (typeof window !== "undefined" ? loadPropFirmRules() : config.prop_firm_rules ?? defaultPropFirmRules());
    apiRules =
      deskMode === "prop_firm"
        ? propFirmRulesForApi({ ...propRules, enabled: true })
        : propFirmRulesForApi(propRules);
    profileId = typeof window !== "undefined" ? getStoredActiveProfileId() ?? undefined : undefined;
  }
  return {
    agents: config.agents.map((a) => ({
      role: a.role,
      name: a.name?.trim() || undefined,
      provider: a.provider,
      api_key: a.api_key.trim(),
      model: a.model.trim(),
      base_url: a.base_url?.trim() || undefined,
      system_prompt: a.system_prompt?.trim() || undefined,
      skills: a.skills?.trim() || undefined,
      temperature: a.temperature,
    })),
    symbol: config.symbol.trim(),
    wait_for_new_candle: config.wait_for_new_candle,
    trading_mode: config.trading_mode,
    trading_strategy: config.trading_strategy,
    user_prompt: config.user_prompt.trim() || undefined,
    account_mode: accountMode,
    prop_firm_rules: apiRules,
    prop_firm_profile_id: profileId,
    desk_mode: deskMode,
    execute: deskMode === "prop_firm" ? true : config.execute,
  };
}

export async function checkAgentHealth(agent: AgentConfig): Promise<AgentHealthCheckResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/multi-agent/health-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: agent.provider,
      api_key: agent.api_key.trim(),
      model: agent.model.trim(),
      base_url: agent.base_url?.trim() || undefined,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text || "request failed"}`);
  }
  return (await res.json()) as AgentHealthCheckResponse;
}

export async function runMultiAgentOnce(
  config: MultiAgentStoredConfig,
  deskOptions?: BuildPayloadOptions,
): Promise<MultiAgentRunResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/multi-agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPayload(config, deskOptions)),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatStreamHttpError(res.status, text));
  }
  return (await res.json()) as MultiAgentRunResponse;
}

export type LivePosition = {
  open: boolean;
  tickets?: (number | string)[];
  side?: "buy" | "sell";
  volume?: number;
  entry_price?: number;
  current_price?: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  profit?: number;
  position_count?: number;
};

export type MonitorAction = "hold" | "close" | "modify";

export type MonitorDecision = {
  action: MonitorAction;
  new_stop_loss: number | null;
  new_take_profit: number | null;
  reason: string;
};

export type MonitorRequest = {
  agents: AgentConfig[];
  symbol: string;
  trading_mode: TradingMode;
  trading_strategy: TradingStrategy;
  user_prompt?: string;
  prop_firm_rules?: PropFirmRules;
  prop_firm_profile_id?: number;
  desk_mode?: DeskMode;
  interval_seconds: number;
  max_iterations: number;
  execute: boolean;
};

export type MonitorStreamHandlers = {
  onStatus?: (data: { message: string }) => void;
  onPositionUpdate?: (data: { iteration: number; position: LivePosition }) => void;
  onAgentStart?: (data: { role: AgentRole; name?: string; provider: string; model: string }) => void;
  onAgentToken?: (data: { role: AgentRole; token: string }) => void;
  onAgentDone?: (data: { role: AgentRole; name?: string; provider: string; model: string; output: string }) => void;
  onMonitorDecision?: (data: {
    iteration: number;
    decision: MonitorDecision;
    execution: Record<string, unknown>;
    position: LivePosition;
  }) => void;
  onPositionClosed?: (data: { iteration: number; reason: string }) => void;
  onMonitorDone?: (data: { iterations: number; last_action: MonitorAction | null }) => void;
  onError?: (message: string) => void;
};

function buildMonitorPayload(
  config: MultiAgentStoredConfig,
  options: { intervalSeconds: number; maxIterations: number },
  deskOptions?: BuildPayloadOptions,
): MonitorRequest {
  const base = buildPayload(config, deskOptions);
  return {
    agents: base.agents,
    symbol: base.symbol,
    trading_mode: base.trading_mode,
    trading_strategy: base.trading_strategy,
    user_prompt: base.user_prompt,
    prop_firm_rules: base.prop_firm_rules,
    prop_firm_profile_id: base.prop_firm_profile_id,
    desk_mode: base.desk_mode,
    execute: base.execute,
    interval_seconds: options.intervalSeconds,
    max_iterations: options.maxIterations,
  };
}

export type AutoTradeRequestPayload = MultiAgentRunRequest & {
  entry_interval_seconds: number;
  monitor_interval_seconds: number;
  monitor_max_iterations: number;
};

export function buildAutoTradePayload(
  config: MultiAgentStoredConfig,
  options: { monitorIntervalSeconds: number; monitorMaxIterations?: number },
  deskOptions?: BuildPayloadOptions,
): AutoTradeRequestPayload {
  return {
    ...buildPayload(config, deskOptions),
    entry_interval_seconds: Math.min(7200, Math.max(0, Math.round(config.auto_trade_entry_interval_seconds))),
    monitor_interval_seconds: Math.min(600, Math.max(5, Math.round(options.monitorIntervalSeconds))),
    monitor_max_iterations: Math.min(
      500_000,
      Math.max(1, Math.round(options.monitorMaxIterations ?? 100_000)),
    ),
  };
}

export type AutoTradeStreamHandlers = MultiAgentStreamHandlers &
  Pick<
    MonitorStreamHandlers,
    | "onPositionUpdate"
    | "onMonitorDecision"
    | "onPositionClosed"
  > & {
    onMonitorDone?: MonitorStreamHandlers["onMonitorDone"];
    onRecoverableError?: (message: string, round?: number) => void;
    onAutoTradeStarted?: (data: Record<string, unknown>) => void;
    onAutoTradeRound?: (data: { round: number; phase: string }) => void;
    onAutoTradeDone?: (data: Record<string, unknown>) => void;
  };

type StopFnAuto = () => void;

export function streamAutoTrade(
  config: MultiAgentStoredConfig,
  options: { monitorIntervalSeconds: number; monitorMaxIterations?: number },
  handlers: AutoTradeStreamHandlers,
  deskOptions?: BuildPayloadOptions,
): StopFnAuto {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/multi-agent/auto-trade-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(buildAutoTradePayload(config, options, deskOptions)),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        handlers.onError?.(formatStreamHttpError(res.status, text));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const dispatch = (eventType: string, dataText: string) => {
        let parsed: unknown = dataText;
        try {
          parsed = JSON.parse(dataText);
        } catch {
          parsed = dataText;
        }
        switch (eventType) {
          case "status":
            handlers.onStatus?.(
              typeof parsed === "object" && parsed && "message" in parsed
                ? (parsed as { message: string })
                : { message: String(parsed) },
            );
            break;
          case "agent_start":
            handlers.onAgentStart?.(parsed as { role: AgentRole; name?: string; provider: string; model: string });
            break;
          case "agent_token":
            handlers.onAgentToken?.(parsed as { role: AgentRole; token: string });
            break;
          case "agent_done":
            handlers.onAgentDone?.(
              parsed as { role: AgentRole; name?: string; provider: string; model: string; output: string },
            );
            break;
          case "done":
            handlers.onDone?.(parsed as MultiAgentRunResult);
            break;
          case "cancelled":
            handlers.onCancelled?.(
              typeof parsed === "object" && parsed && "message" in parsed
                ? String((parsed as { message: string }).message)
                : "Auto-trading stopped",
            );
            break;
          case "position_update":
            handlers.onPositionUpdate?.(parsed as { iteration: number; position: LivePosition });
            break;
          case "monitor_decision":
            handlers.onMonitorDecision?.(
              parsed as {
                iteration: number;
                decision: MonitorDecision;
                execution: Record<string, unknown>;
                position: LivePosition;
              },
            );
            break;
          case "position_closed":
            handlers.onPositionClosed?.(parsed as { iteration: number; reason: string });
            break;
          case "monitor_done":
            handlers.onMonitorDone?.(parsed as { iterations: number; last_action: MonitorAction | null });
            break;
          case "auto_trade_started":
            handlers.onAutoTradeStarted?.(
              typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : {},
            );
            break;
          case "auto_trade_round":
            if (typeof parsed === "object" && parsed && "round" in parsed && "phase" in parsed) {
              handlers.onAutoTradeRound?.({
                round: Number((parsed as { round: unknown }).round),
                phase: String((parsed as { phase: unknown }).phase),
              });
            }
            break;
          case "auto_trade_done":
            handlers.onAutoTradeDone?.(
              typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : {},
            );
            break;
          case "error": {
            const e = parsed as { error?: unknown; recoverable?: boolean; round?: number };
            const msg = String(e.error ?? parsed);
            if (e.recoverable) {
              handlers.onRecoverableError?.(msg, e.round);
            } else {
              handlers.onError?.(msg);
            }
            break;
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let separatorIndex = buffer.indexOf("\n\n");
        while (separatorIndex !== -1) {
          const block = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          const lines = block.split(/\r?\n/);
          let eventType = "message";
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith(":")) continue;
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).replace(/^\s/, ""));
            }
          }
          if (dataLines.length > 0) {
            dispatch(eventType, dataLines.join("\n"));
          }
          separatorIndex = buffer.indexOf("\n\n");
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      handlers.onError?.((err as Error).message);
    }
  })();

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    void cancelActiveTradingCycle();
    controller.abort();
    handlers.onCancelled?.("Auto-trading stopped");
  };
}

type StopFnMon = () => void;

export function streamMonitor(
  config: MultiAgentStoredConfig,
  options: { intervalSeconds: number; maxIterations: number },
  handlers: MonitorStreamHandlers,
  deskOptions?: BuildPayloadOptions,
): StopFnMon {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/multi-agent/monitor-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(buildMonitorPayload(config, options, deskOptions)),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        handlers.onError?.(formatStreamHttpError(res.status, text));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const dispatch = (eventType: string, dataText: string) => {
        let parsed: unknown = dataText;
        try {
          parsed = JSON.parse(dataText);
        } catch {
          parsed = dataText;
        }
        switch (eventType) {
          case "status":
            handlers.onStatus?.(
              typeof parsed === "object" && parsed && "message" in parsed
                ? (parsed as { message: string })
                : { message: String(parsed) },
            );
            break;
          case "position_update":
            handlers.onPositionUpdate?.(parsed as { iteration: number; position: LivePosition });
            break;
          case "agent_start":
            handlers.onAgentStart?.(parsed as { role: AgentRole; name?: string; provider: string; model: string });
            break;
          case "agent_token":
            handlers.onAgentToken?.(parsed as { role: AgentRole; token: string });
            break;
          case "agent_done":
            handlers.onAgentDone?.(
              parsed as { role: AgentRole; name?: string; provider: string; model: string; output: string },
            );
            break;
          case "monitor_decision":
            handlers.onMonitorDecision?.(
              parsed as {
                iteration: number;
                decision: MonitorDecision;
                execution: Record<string, unknown>;
                position: LivePosition;
              },
            );
            break;
          case "position_closed":
            handlers.onPositionClosed?.(parsed as { iteration: number; reason: string });
            break;
          case "monitor_done":
            handlers.onMonitorDone?.(parsed as { iterations: number; last_action: MonitorAction | null });
            break;
          case "error":
            handlers.onError?.(
              typeof parsed === "object" && parsed && "error" in parsed
                ? String((parsed as { error: unknown }).error)
                : String(parsed),
            );
            break;
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let separatorIndex = buffer.indexOf("\n\n");
        while (separatorIndex !== -1) {
          const block = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          const lines = block.split(/\r?\n/);
          let eventType = "message";
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith(":")) continue;
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).replace(/^\s/, ""));
            }
          }
          if (dataLines.length > 0) {
            dispatch(eventType, dataLines.join("\n"));
          }
          separatorIndex = buffer.indexOf("\n\n");
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      handlers.onError?.((err as Error).message);
    }
  })();

  return () => controller.abort();
}

export type MultiAgentStreamHandlers = {
  onStatus?: (data: { message: string }) => void;
  onAgentStart?: (data: { role: AgentRole; name?: string; provider: string; model: string }) => void;
  onAgentToken?: (data: { role: AgentRole; token: string }) => void;
  onAgentDone?: (data: { role: AgentRole; name?: string; provider: string; model: string; output: string }) => void;
  onDone?: (data: MultiAgentRunResult) => void;
  onCancelled?: (message: string) => void;
  onError?: (message: string) => void;
};

type StopFn = () => void;

export function streamMultiAgent(
  config: MultiAgentStoredConfig,
  handlers: MultiAgentStreamHandlers,
  deskOptions?: BuildPayloadOptions,
): StopFn {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/multi-agent/run-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(buildPayload(config, deskOptions)),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        handlers.onError?.(formatStreamHttpError(res.status, text));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const dispatch = (eventType: string, dataText: string) => {
        let parsed: unknown = dataText;
        try {
          parsed = JSON.parse(dataText);
        } catch {
          parsed = dataText;
        }
        switch (eventType) {
          case "status":
            handlers.onStatus?.(
              typeof parsed === "object" && parsed && "message" in parsed
                ? (parsed as { message: string })
                : { message: String(parsed) },
            );
            break;
          case "agent_start":
            handlers.onAgentStart?.(parsed as { role: AgentRole; name?: string; provider: string; model: string });
            break;
          case "agent_token":
            handlers.onAgentToken?.(parsed as { role: AgentRole; token: string });
            break;
          case "agent_done":
            handlers.onAgentDone?.(
              parsed as { role: AgentRole; name?: string; provider: string; model: string; output: string },
            );
            break;
          case "done":
            handlers.onDone?.(parsed as MultiAgentRunResult);
            break;
          case "cancelled":
            handlers.onCancelled?.(
              typeof parsed === "object" && parsed && "message" in parsed
                ? String((parsed as { message: string }).message)
                : "Cycle stopped",
            );
            break;
          case "error":
            handlers.onError?.(
              typeof parsed === "object" && parsed && "error" in parsed
                ? String((parsed as { error: unknown }).error)
                : String(parsed),
            );
            break;
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let separatorIndex = buffer.indexOf("\n\n");
        while (separatorIndex !== -1) {
          const block = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          const lines = block.split(/\r?\n/);
          let eventType = "message";
          const dataLines: string[] = [];
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).replace(/^\s/, ""));
            }
          }
          if (dataLines.length > 0) {
            dispatch(eventType, dataLines.join("\n"));
          }
          separatorIndex = buffer.indexOf("\n\n");
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      handlers.onError?.((err as Error).message);
    }
  })();

  return () => {
    void cancelActiveTradingCycle();
    controller.abort();
  };
}
