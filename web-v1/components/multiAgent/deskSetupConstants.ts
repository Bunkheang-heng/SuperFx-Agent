import type { TradingMode, TradingStrategy } from "@/lib/api";

export const TRADING_MODE_OPTIONS: { id: TradingMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "aggressive", label: "Aggressive" },
  { id: "scalper", label: "Scalper" },
  { id: "day_trader", label: "Day Trader" },
  { id: "swing_trader", label: "Swing Trader" },
  { id: "breakout", label: "Breakout" },
  { id: "mean_reversion", label: "Mean Reversion" },
];

export const STRATEGY_OPTIONS: { id: TradingStrategy; label: string }[] = [
  { id: "none", label: "No filter" },
  { id: "smc", label: "SMC" },
  { id: "ict", label: "ICT" },
  { id: "supply_demand", label: "Supply / Demand" },
  { id: "support_resistance", label: "Support / Resistance" },
  { id: "trend_following", label: "Trend Following" },
  { id: "breakout_retest", label: "Breakout Retest" },
];

export const QUICK_SYMBOLS = ["XAUUSDm", "GBPUSDm", "EURUSDm", "USDJPYm", "BTCUSDm"] as const;

export const MONITOR_INTERVAL_OPTIONS = [15, 30, 60, 120, 300] as const;
export const AUTO_ENTRY_INTERVAL_OPTIONS = [0, 30, 60, 120, 300, 600] as const;

/** Prop firm evaluations often need slower, deliberate reviews. */
export const PROP_FIRM_MONITOR_INTERVAL_OPTIONS = [30, 60, 120, 300] as const;
export const PROP_FIRM_ENTRY_INTERVAL_OPTIONS = [60, 120, 300, 600] as const;
