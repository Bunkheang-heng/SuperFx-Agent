export type TradingAccountMode = "real" | "demo" | "prop_firm";

export const TRADING_ACCOUNT_MODE_KEY = "thinktrade.tradingAccountMode.v1";

export function isTradingAccountMode(value: string | null | undefined): value is TradingAccountMode {
  return value === "real" || value === "demo" || value === "prop_firm";
}

export function loadTradingAccountMode(): TradingAccountMode {
  if (typeof window === "undefined") return "demo";
  try {
    const stored = window.localStorage.getItem(TRADING_ACCOUNT_MODE_KEY);
    return isTradingAccountMode(stored) ? stored : "demo";
  } catch {
    return "demo";
  }
}

export function saveTradingAccountMode(mode: TradingAccountMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TRADING_ACCOUNT_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function tradingAccountModeLabel(mode: TradingAccountMode): string {
  if (mode === "prop_firm") return "Prop firm / funded";
  if (mode === "real") return "Real account";
  return "Demo account";
}

export function tradingAccountModeDescription(mode: TradingAccountMode): string {
  if (mode === "prop_firm") {
    return "Evaluation or funded program — prop firm rules, compliance, and evaluation prompts apply.";
  }
  if (mode === "real") {
    return "Your live MT5 broker account — no prop firm rules or compliance limits.";
  }
  return "Practice MT5 demo account — no prop firm rules or compliance limits.";
}

export function tradingAccountModeShortLabel(mode: TradingAccountMode): string {
  if (mode === "prop_firm") return "Prop firm";
  if (mode === "real") return "Real";
  return "Demo";
}
