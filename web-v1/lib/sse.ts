import { getApiBaseUrl } from "./api";

export type StreamHandlers = {
  onStatus?: (data: string) => void;
  onToken?: (data: string) => void;
  onDone?: (data: unknown) => void;
  onError?: (err: string) => void;
};

export type StreamOptions = {
  provider: string;
  model?: string;
  symbol?: string;
  waitForNewCandle?: boolean;
  tradingMode?: string;
  tradingStrategy?: string;
  userPrompt?: string;
  propFirmRules?: import("./propFirm").PropFirmRules;
  accountMode?: import("./tradingAccount").TradingAccountMode;
  propFirmProfileId?: number;
};

export type PositionInsightStreamOptions = {
  provider: string;
  model?: string;
  question: string;
};

export function runCycleStream(opts: StreamOptions, handlers: StreamHandlers): () => void {
  const params = new URLSearchParams({
    provider: opts.provider,
    wait_for_new_candle: String(opts.waitForNewCandle ?? true),
  });
  if (opts.model) params.set("model", opts.model);
  if (opts.symbol) params.set("symbol", opts.symbol);
  if (opts.tradingMode) params.set("trading_mode", opts.tradingMode);
  if (opts.tradingStrategy) params.set("trading_strategy", opts.tradingStrategy);
  if (opts.userPrompt) params.set("user_prompt", opts.userPrompt);
  params.set("account_mode", opts.accountMode ?? "real");
  if (opts.propFirmRules) {
    params.set("prop_firm_rules_json", JSON.stringify(opts.propFirmRules));
  }
  if (opts.propFirmProfileId != null) {
    params.set("prop_firm_profile_id", String(opts.propFirmProfileId));
  }

  const url = `${getApiBaseUrl()}/api/trading/run-cycle-stream?${params.toString()}`;
  const source = new EventSource(url);

  source.addEventListener("status", (e) => handlers.onStatus?.((e as MessageEvent).data));
  source.addEventListener("token", (e) => handlers.onToken?.((e as MessageEvent).data));
  source.addEventListener("done", (e) => {
    try {
      handlers.onDone?.(JSON.parse((e as MessageEvent).data));
    } catch {
      handlers.onDone?.((e as MessageEvent).data);
    }
    source.close();
  });
  source.addEventListener("error", (e) => {
    const msg = (e as MessageEvent).data ?? "stream error";
    handlers.onError?.(String(msg));
    source.close();
  });

  return () => source.close();
}

export function runPositionInsightStream(
  opts: PositionInsightStreamOptions,
  handlers: StreamHandlers,
): () => void {
  const params = new URLSearchParams({
    provider: opts.provider,
    question: opts.question,
  });
  if (opts.model) params.set("model", opts.model);

  const url = `${getApiBaseUrl()}/api/trading/positions-insight-stream?${params.toString()}`;
  const source = new EventSource(url);

  source.addEventListener("status", (e) => handlers.onStatus?.((e as MessageEvent).data));
  source.addEventListener("token", (e) => handlers.onToken?.((e as MessageEvent).data));
  source.addEventListener("done", (e) => {
    try {
      handlers.onDone?.(JSON.parse((e as MessageEvent).data));
    } catch {
      handlers.onDone?.((e as MessageEvent).data);
    }
    source.close();
  });
  source.addEventListener("error", (e) => {
    let message = "stream error";
    try {
      const raw = (e as MessageEvent).data;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      message = String(parsed?.error ?? raw ?? message);
    } catch {
      message = String((e as MessageEvent).data ?? message);
    }
    handlers.onError?.(message);
    source.close();
  });

  return () => source.close();
}
