function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

const CONFIGURED_API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000",
);

/** Same-origin proxy path used when the page is HTTPS but the API is HTTP. */
export const API_PROXY_BASE_URL = "/backend-api";

export function getApiBaseUrl(): string {
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    CONFIGURED_API_BASE_URL.startsWith("http://")
  ) {
    return API_PROXY_BASE_URL;
  }
  return CONFIGURED_API_BASE_URL;
}

/** @deprecated Use getApiBaseUrl() so HTTPS deployments can proxy to HTTP backends. */
export const API_BASE_URL = CONFIGURED_API_BASE_URL;

export type ProviderInfo = {
  provider: "openai" | "gemini" | "sealion";
  default_model: string;
  configured: boolean;
};

export type TradingMode =
  | "auto"
  | "aggressive"
  | "scalper"
  | "day_trader"
  | "swing_trader"
  | "breakout"
  | "mean_reversion";

export type TradingStrategy =
  | "none"
  | "smc"
  | "ict"
  | "supply_demand"
  | "support_resistance"
  | "trend_following"
  | "breakout_retest";

export type ProvidersResponse = {
  providers: ProviderInfo[];
};

export type EquityCurvePoint = {
  time: number;
  equity: number;
};

export type EquityCurveResponse = {
  points: EquityCurvePoint[];
  current_equity: number;
  start_equity: number;
  change: number;
  change_pct: number;
  lookback_days: number;
  currency?: string | null;
};

export type ConnectionStatus = {
  connected: boolean;
  demo_only: boolean;
  symbol?: string;
  timeframe?: string;
  tick?: Record<string, unknown>;
  positions?: Record<string, unknown>[];
  account?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
};

export type RunCycleResult = {
  wait_for_new_candle: boolean;
  provider: string;
  model: string;
  trading_mode: TradingMode;
  trading_strategy: TradingStrategy;
  symbol: string;
  snapshot: Record<string, unknown>;
  decision: {
    symbol: string;
    action: "hold" | "buy" | "sell" | "buy_limit" | "sell_limit" | "buy_stop" | "sell_stop";
    confidence: number;
    reason: string;
    lot_size: number;
    entry_price?: number | null;
    stop_loss?: number | null;
    take_profit?: number | null;
    time_in_force?: "gtc" | "day";
    cancel_if_not_filled_minutes?: number | null;
  };
  execution: Record<string, unknown>;
};

export type RunCycleResponse = {
  success: boolean;
  message: string;
  result: RunCycleResult;
};

export type TradeHistoryItem = {
  ticket: number | string;
  order?: number | string | null;
  position_id?: number | string | null;
  time: number;
  time_msc?: number;
  symbol?: string | null;
  type: string;
  entry: string;
  volume?: number | null;
  price?: number | null;
  profit?: number | null;
  commission?: number | null;
  swap?: number | null;
  fee?: number | null;
  reason?: number | string | null;
  comment?: string | null;
};

export type TradeHistoryResponse = {
  items: TradeHistoryItem[];
  count: number;
  total_count: number;
  limit: number;
  offset: number;
  lookback_days: number;
  outcome_filter: "all" | "win" | "loss" | "breakeven";
  date_from?: string | null;
  date_to?: string | null;
  symbol?: string | null;
};

export type PositionInsightResponse = {
  success: boolean;
  message: string;
  result: {
    provider: string;
    model: string;
    question: string;
    answer: string;
    context: Record<string, unknown>;
    prompt: string;
  };
};

export type AllRecentLogs = Record<string, LogEntry[]>;

export type LogEntry = {
  timestamp: string;
  level: "info" | "error";
  message: string;
  extra?: Record<string, unknown>;
};

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text || "request failed"}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async health(): Promise<{ status: string; service: string; timestamp: string }> {
    return handle(await fetch(`${getApiBaseUrl()}/api/health`, { cache: "no-store" }));
  },

  async providers(): Promise<ProvidersResponse> {
    return handle(await fetch(`${getApiBaseUrl()}/api/trading/providers`, { cache: "no-store" }));
  },

  async status(): Promise<ConnectionStatus> {
    return handle(await fetch(`${getApiBaseUrl()}/api/trading/status`, { cache: "no-store" }));
  },

  async equityCurve(lookbackDays = 30): Promise<EquityCurveResponse> {
    const params = new URLSearchParams({ lookback_days: String(lookbackDays) });
    return handle(
      await fetch(`${getApiBaseUrl()}/api/trading/equity-curve?${params.toString()}`, { cache: "no-store" }),
    );
  },

  async history(options?: {
    limit?: number;
    offset?: number;
    lookbackDays?: number;
    symbol?: string;
    outcomeFilter?: "all" | "win" | "loss" | "breakeven";
    dateFrom?: string;
    dateTo?: string;
  }): Promise<TradeHistoryResponse> {
    const {
      limit = 200,
      offset = 0,
      lookbackDays = 30,
      symbol,
      outcomeFilter = "all",
      dateFrom,
      dateTo,
    } = options ?? {};
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      lookback_days: String(lookbackDays),
      outcome_filter: outcomeFilter,
    });
    if (symbol?.trim()) params.set("symbol", symbol.trim());
    if (dateFrom?.trim()) params.set("date_from", dateFrom.trim());
    if (dateTo?.trim()) params.set("date_to", dateTo.trim());
    return handle(
      await fetch(`${getApiBaseUrl()}/api/trading/history?${params.toString()}`, { cache: "no-store" }),
    );
  },

  async connect(payload: { login?: string; password?: string; server?: string }) {
    return handle<{ success: boolean; message: string; data: ConnectionStatus }>(
      await fetch(`${getApiBaseUrl()}/api/trading/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },

  async disconnect() {
    return handle<{ success: boolean; message: string; data: ConnectionStatus }>(
      await fetch(`${getApiBaseUrl()}/api/trading/disconnect`, { method: "POST" }),
    );
  },

  async runCycle(payload: {
    provider: string;
    model?: string;
    symbol: string;
    wait_for_new_candle: boolean;
    trading_mode: TradingMode;
    trading_strategy: TradingStrategy;
    user_prompt?: string;
    prop_firm_rules?: import("./propFirm").PropFirmRules;
    prop_firm_profile_id?: number;
  }) {
    return handle<RunCycleResponse>(
      await fetch(`${getApiBaseUrl()}/api/trading/run-cycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },

  async positionsInsight(payload: { provider: string; model?: string; question: string }) {
    return handle<PositionInsightResponse>(
      await fetch(`${getApiBaseUrl()}/api/trading/positions-insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },

  async allRecent(limit = 25): Promise<AllRecentLogs> {
    return handle(
      await fetch(`${getApiBaseUrl()}/api/logs/all-recent?limit=${limit}`, { cache: "no-store" }),
    );
  },
};
