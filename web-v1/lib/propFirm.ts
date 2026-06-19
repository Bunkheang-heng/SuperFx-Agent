export type PropFirmRules = {
  enabled: boolean;
  firm_name?: string | null;
  custom_rules?: string | null;
  max_daily_loss_pct?: number | null;
  max_drawdown_pct?: number | null;
  profit_target_pct?: number | null;
  account_size?: number | null;
  max_risk_per_trade_pct?: number | null;
  require_stop_loss?: boolean | null;
  max_lot?: number | null;
  max_trades_per_day?: number | null;
  max_open_positions?: number | null;
  min_trading_days?: number | null;
  allowed_symbols?: string | null;
  forbidden_symbols?: string | null;
  news_trading_allowed?: boolean | null;
  weekend_holding_allowed?: boolean | null;
  consistency_rule?: string | null;
};

export const PROP_FIRM_STORAGE_KEY = "thinktrade.propFirm.rules.v1";
export const PROP_FIRM_UPDATED_EVENT = "thinktrade:prop-firm-updated";

export type PropFirmPresetId =
  | "custom"
  | "holaprime_1step"
  | "holaprime_2step_p1"
  | "holaprime_2step_p2"
  | "holaprime_direct"
  | "ftmo"
  | "fundednext"
  | "the5ers";

export type PropFirmPreset = {
  id: PropFirmPresetId;
  label: string;
  description: string;
  rules: Omit<PropFirmRules, "enabled">;
};

export const PROP_FIRM_PRESETS: PropFirmPreset[] = [
  {
    id: "custom",
    label: "Custom",
    description: "Start blank and paste your own firm rules.",
    rules: defaultPropFirmRulesContent(),
  },
  {
    id: "holaprime_1step",
    label: "Hola Prime · 1-Step Prime ($2K)",
    description: "Single-phase: 10% target, 3% daily loss, 6% max overall loss. Recommended for the desk.",
    rules: {
      firm_name: "Hola Prime — 1-Step Prime ($2K)",
      custom_rules:
        "Hola Prime 1-Step Prime Challenge ($2,000 account):\n" +
        "- Profit target: 10% = $200 (reach equity $2,200 to pass).\n" +
        "- Max daily loss: 3% = $60 of the previous day's closing balance. Counts floating + closed P/L. Resets 17:00 EST.\n" +
        "- Max overall loss (static): 6% = $120. Equity must NEVER touch $1,880, even intraday — instant breach.\n" +
        "- Every position MUST have a stop loss; risk per trade capped at 2% = $40.\n" +
        "- Minimum 2 trading days before the account can pass. No maximum time limit.\n" +
        "- Leverage up to 1:30. News trading and weekend/overnight holding are allowed on Prime.\n" +
        "- No consistency rule on 1-Step Prime.\n" +
        "Priority: protect the $1,880 floor first, the $60 daily floor second, then grind toward $200 target with high-quality setups.",
      max_daily_loss_pct: 3,
      max_drawdown_pct: 6,
      profit_target_pct: 10,
      account_size: 2000,
      max_risk_per_trade_pct: 2,
      require_stop_loss: true,
      min_trading_days: 2,
      max_open_positions: 1,
      news_trading_allowed: true,
      weekend_holding_allowed: true,
      consistency_rule: "No consistency rule on 1-Step Prime.",
      max_lot: null,
      max_trades_per_day: null,
      allowed_symbols: "",
      forbidden_symbols: "",
    },
  },
  {
    id: "holaprime_2step_p1",
    label: "Hola Prime · 2-Step Prime — Phase 1 ($2K)",
    description: "Phase 1: 8% target, 5% daily loss, 10% max overall loss.",
    rules: {
      firm_name: "Hola Prime — 2-Step Prime P1 ($2K)",
      custom_rules:
        "Hola Prime 2-Step Prime Challenge — Phase 1 ($2,000 account):\n" +
        "- Phase 1 profit target: 8% = $160 (reach equity $2,160).\n" +
        "- Max daily loss: 5% = $100 of the previous day's closing balance (floating + closed). Resets 17:00 EST.\n" +
        "- Max overall loss: 10% = $200. Equity floor $1,800 — instant breach if touched.\n" +
        "- Every position MUST have a stop loss; risk per trade capped at 2% = $40.\n" +
        "- Minimum 2 trading days. No time limit. Leverage up to 1:30. News + weekend holding allowed.",
      max_daily_loss_pct: 5,
      max_drawdown_pct: 10,
      profit_target_pct: 8,
      account_size: 2000,
      max_risk_per_trade_pct: 2,
      require_stop_loss: true,
      min_trading_days: 2,
      max_open_positions: 1,
      news_trading_allowed: true,
      weekend_holding_allowed: true,
      consistency_rule: "",
      max_lot: null,
      max_trades_per_day: null,
      allowed_symbols: "",
      forbidden_symbols: "",
    },
  },
  {
    id: "holaprime_2step_p2",
    label: "Hola Prime · 2-Step Prime — Phase 2 ($2K)",
    description: "Phase 2: 5% target, 5% daily loss, 10% max overall loss.",
    rules: {
      firm_name: "Hola Prime — 2-Step Prime P2 ($2K)",
      custom_rules:
        "Hola Prime 2-Step Prime Challenge — Phase 2 ($2,000 account):\n" +
        "- Phase 2 profit target: 5% = $100 (reach equity $2,100).\n" +
        "- Max daily loss: 5% = $100 of the previous day's closing balance (floating + closed). Resets 17:00 EST.\n" +
        "- Max overall loss: 10% = $200. Equity floor $1,800 — instant breach if touched.\n" +
        "- Every position MUST have a stop loss; risk per trade capped at 2% = $40.\n" +
        "- Minimum 2 trading days. No time limit. Leverage up to 1:30. News + weekend holding allowed.",
      max_daily_loss_pct: 5,
      max_drawdown_pct: 10,
      profit_target_pct: 5,
      account_size: 2000,
      max_risk_per_trade_pct: 2,
      require_stop_loss: true,
      min_trading_days: 2,
      max_open_positions: 1,
      news_trading_allowed: true,
      weekend_holding_allowed: true,
      consistency_rule: "",
      max_lot: null,
      max_trades_per_day: null,
      allowed_symbols: "",
      forbidden_symbols: "",
    },
  },
  {
    id: "holaprime_direct",
    label: "Hola Prime · Direct ($2K, funded)",
    description: "No profit target: ~3% daily loss, ~5% trailing overall. (Desk needs a target — set one to run.)",
    rules: {
      firm_name: "Hola Prime — Direct ($2K)",
      custom_rules:
        "Hola Prime Direct Account ($2,000, instant funded):\n" +
        "- No profit target to pass — focus on consistent gains and payouts.\n" +
        "- Max daily loss: ~3% = $60 of the previous day's closing balance.\n" +
        "- Max overall loss: ~5% = $100 TRAILING from the equity high-water mark.\n" +
        "- Every position MUST have a stop loss; risk per trade capped at 2% = $40.\n" +
        "- Min withdrawal profit 0.5% of balance. Profit split up to 90%.",
      max_daily_loss_pct: 3,
      max_drawdown_pct: 5,
      profit_target_pct: null,
      account_size: 2000,
      max_risk_per_trade_pct: 2,
      require_stop_loss: true,
      min_trading_days: null,
      max_open_positions: 1,
      news_trading_allowed: true,
      weekend_holding_allowed: true,
      consistency_rule: "",
      max_lot: null,
      max_trades_per_day: null,
      allowed_symbols: "",
      forbidden_symbols: "",
    },
  },
  {
    id: "ftmo",
    label: "FTMO (template)",
    description: "Common evaluation-style limits — adjust to your exact challenge.",
    rules: {
      firm_name: "FTMO",
      custom_rules:
        "- Do not exceed max daily loss or max loss limits\n" +
        "- No martingale or grid without approval\n" +
        "- Trade only during allowed sessions if specified by your challenge\n" +
        "- Respect minimum trading days before payout",
      max_daily_loss_pct: 5,
      max_drawdown_pct: 10,
      profit_target_pct: 10,
      max_open_positions: 1,
      min_trading_days: 4,
      news_trading_allowed: false,
      weekend_holding_allowed: false,
      consistency_rule: "Best single day profit should not exceed ~50% of total profit (verify your plan).",
      max_lot: null,
      max_trades_per_day: null,
      allowed_symbols: "",
      forbidden_symbols: "",
    },
  },
  {
    id: "fundednext",
    label: "FundedNext (template)",
    description: "Starter template for evaluation accounts.",
    rules: {
      firm_name: "FundedNext",
      custom_rules:
        "- Stay within daily and overall loss limits\n" +
        "- Avoid prohibited strategies (arbitrage, tick scalping, etc. per firm policy)\n" +
        "- Follow news-trading restrictions if on your plan",
      max_daily_loss_pct: 5,
      max_drawdown_pct: 10,
      profit_target_pct: 8,
      max_open_positions: 2,
      min_trading_days: 5,
      news_trading_allowed: false,
      weekend_holding_allowed: null,
      consistency_rule: "",
      max_lot: null,
      max_trades_per_day: null,
      allowed_symbols: "",
      forbidden_symbols: "",
    },
  },
  {
    id: "the5ers",
    label: "The5ers (template)",
    description: "Conservative template — tune to your program tier.",
    rules: {
      firm_name: "The5ers",
      custom_rules:
        "- Respect stop-loss requirement on every trade\n" +
        "- Do not exceed max risk per trade\n" +
        "- Follow symbol and lot restrictions from your dashboard",
      max_daily_loss_pct: 4,
      max_drawdown_pct: 6,
      profit_target_pct: 6,
      max_open_positions: 1,
      min_trading_days: 3,
      news_trading_allowed: null,
      weekend_holding_allowed: false,
      consistency_rule: "",
      max_lot: null,
      max_trades_per_day: null,
      allowed_symbols: "",
      forbidden_symbols: "",
    },
  },
];

function defaultPropFirmRulesContent(): Omit<PropFirmRules, "enabled"> {
  return {
    firm_name: "",
    custom_rules: "",
    max_daily_loss_pct: null,
    max_drawdown_pct: null,
    profit_target_pct: null,
    account_size: null,
    max_risk_per_trade_pct: null,
    require_stop_loss: null,
    max_lot: null,
    max_trades_per_day: null,
    max_open_positions: null,
    min_trading_days: null,
    allowed_symbols: "",
    forbidden_symbols: "",
    news_trading_allowed: null,
    weekend_holding_allowed: null,
    consistency_rule: "",
  };
}

export function defaultPropFirmRules(): PropFirmRules {
  return {
    enabled: false,
    ...defaultPropFirmRulesContent(),
  };
}

export function applyPropFirmPreset(rules: PropFirmRules, presetId: PropFirmPresetId): PropFirmRules {
  const preset = PROP_FIRM_PRESETS.find((p) => p.id === presetId) ?? PROP_FIRM_PRESETS[0];
  return {
    ...rules,
    enabled: true,
    ...preset.rules,
  };
}

export function propFirmRulesSummary(rules: PropFirmRules): string {
  if (!rules.enabled) return "Prop firm rules off";
  const parts: string[] = [];
  if (rules.firm_name?.trim()) parts.push(rules.firm_name.trim());
  if (rules.max_daily_loss_pct != null) parts.push(`${rules.max_daily_loss_pct}% daily`);
  if (rules.max_drawdown_pct != null) parts.push(`${rules.max_drawdown_pct}% DD`);
  if (rules.custom_rules?.trim()) parts.push("custom rules");
  return parts.length > 0 ? parts.join(" · ") : "Rules active";
}

export function isPropFirmRulesActive(rules: PropFirmRules): boolean {
  return !!propFirmRulesForApi(rules);
}

export function loadPropFirmRules(): PropFirmRules {
  if (typeof window === "undefined") return defaultPropFirmRules();
  try {
    const raw = window.localStorage.getItem(PROP_FIRM_STORAGE_KEY);
    if (!raw) return defaultPropFirmRules();
    const parsed = JSON.parse(raw) as Partial<PropFirmRules>;
    return { ...defaultPropFirmRules(), ...parsed };
  } catch {
    return defaultPropFirmRules();
  }
}

export function savePropFirmRules(rules: PropFirmRules): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROP_FIRM_STORAGE_KEY, JSON.stringify(rules));
    window.dispatchEvent(new CustomEvent(PROP_FIRM_UPDATED_EVENT, { detail: rules }));
  } catch {
    /* ignore */
  }
}

/** Omit empty optional fields; return undefined when disabled or empty. */
export function propFirmRulesForApi(rules: PropFirmRules): PropFirmRules | undefined {
  if (!rules.enabled) return undefined;

  const payload: PropFirmRules = { enabled: true };

  const firm = rules.firm_name?.trim();
  if (firm) payload.firm_name = firm;

  const custom = rules.custom_rules?.trim();
  if (custom) payload.custom_rules = custom;

  if (rules.max_daily_loss_pct != null && !Number.isNaN(rules.max_daily_loss_pct)) {
    payload.max_daily_loss_pct = rules.max_daily_loss_pct;
  }
  if (rules.max_drawdown_pct != null && !Number.isNaN(rules.max_drawdown_pct)) {
    payload.max_drawdown_pct = rules.max_drawdown_pct;
  }
  if (rules.profit_target_pct != null && !Number.isNaN(rules.profit_target_pct)) {
    payload.profit_target_pct = rules.profit_target_pct;
  }
  if (rules.account_size != null && !Number.isNaN(rules.account_size)) {
    payload.account_size = rules.account_size;
  }
  if (rules.max_risk_per_trade_pct != null && !Number.isNaN(rules.max_risk_per_trade_pct)) {
    payload.max_risk_per_trade_pct = rules.max_risk_per_trade_pct;
  }
  if (rules.require_stop_loss !== null && rules.require_stop_loss !== undefined) {
    payload.require_stop_loss = rules.require_stop_loss;
  }
  if (rules.max_lot != null && !Number.isNaN(rules.max_lot)) {
    payload.max_lot = rules.max_lot;
  }
  if (rules.max_trades_per_day != null && !Number.isNaN(rules.max_trades_per_day)) {
    payload.max_trades_per_day = Math.round(rules.max_trades_per_day);
  }
  if (rules.max_open_positions != null && !Number.isNaN(rules.max_open_positions)) {
    payload.max_open_positions = Math.round(rules.max_open_positions);
  }
  if (rules.min_trading_days != null && !Number.isNaN(rules.min_trading_days)) {
    payload.min_trading_days = Math.round(rules.min_trading_days);
  }

  const allowed = rules.allowed_symbols?.trim();
  if (allowed) payload.allowed_symbols = allowed;
  const forbidden = rules.forbidden_symbols?.trim();
  if (forbidden) payload.forbidden_symbols = forbidden;

  if (rules.news_trading_allowed !== null && rules.news_trading_allowed !== undefined) {
    payload.news_trading_allowed = rules.news_trading_allowed;
  }
  if (rules.weekend_holding_allowed !== null && rules.weekend_holding_allowed !== undefined) {
    payload.weekend_holding_allowed = rules.weekend_holding_allowed;
  }

  const consistency = rules.consistency_rule?.trim();
  if (consistency) payload.consistency_rule = consistency;

  const hasStructured =
    payload.max_daily_loss_pct != null ||
    payload.max_drawdown_pct != null ||
    payload.profit_target_pct != null ||
    payload.account_size != null ||
    payload.max_risk_per_trade_pct != null ||
    payload.require_stop_loss != null ||
    payload.max_lot != null ||
    payload.max_trades_per_day != null ||
    payload.max_open_positions != null ||
    payload.min_trading_days != null ||
    !!payload.allowed_symbols ||
    !!payload.forbidden_symbols ||
    payload.news_trading_allowed != null ||
    payload.weekend_holding_allowed != null ||
    !!payload.consistency_rule;

  if (!custom && !firm && !hasStructured) return undefined;

  return payload;
}
