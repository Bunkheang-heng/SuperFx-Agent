import { API_BASE_URL } from "./api";
import type { PropFirmRules } from "./propFirm";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text || "request failed"}`);
  }
  return (await res.json()) as T;
}

export type PropFirmProfileRecord = {
  id: number;
  name: string;
  firm_name: string | null;
  rules: PropFirmRules;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PropFirmProfileListResponse = {
  profiles: PropFirmProfileRecord[];
  active_id: number | null;
};

export type TradingRunSummary = {
  id: number;
  run_type: string;
  symbol: string;
  trading_mode: string;
  trading_strategy: string;
  provider: string | null;
  model: string | null;
  prop_firm_profile_id: number | null;
  executed: boolean;
  compliance_passed: boolean | null;
  compliance_summary: string | null;
  created_at: string;
};

export type TradingRunDetail = TradingRunSummary & {
  user_prompt: string | null;
  decision: Record<string, unknown> | null;
  execution: Record<string, unknown> | null;
  account_snapshot: Record<string, unknown> | null;
  compliance_events: {
    rule_key: string;
    passed: boolean;
    message: string;
    details: Record<string, unknown> | null;
    created_at: string;
  }[];
  agent_messages: {
    role: string;
    name: string | null;
    provider: string;
    model: string;
    output: string;
    sequence: number;
  }[];
};

export const ACTIVE_PROFILE_ID_KEY = "thinktrade.propFirm.activeProfileId";

export function getStoredActiveProfileId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTIVE_PROFILE_ID_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function setStoredActiveProfileId(id: number | null): void {
  if (typeof window === "undefined") return;
  if (id == null) window.localStorage.removeItem(ACTIVE_PROFILE_ID_KEY);
  else window.localStorage.setItem(ACTIVE_PROFILE_ID_KEY, String(id));
}

export const profilesApi = {
  async listPropFirmProfiles() {
    return handle<PropFirmProfileListResponse>(
      await fetch(`${API_BASE_URL}/api/profiles/prop-firm`, { cache: "no-store" }),
    );
  },

  async getActivePropFirmProfile() {
    const res = await fetch(`${API_BASE_URL}/api/profiles/prop-firm/active`, { cache: "no-store" });
    if (res.status === 404) return null;
    return handle<PropFirmProfileRecord>(res);
  },

  async createPropFirmProfile(payload: {
    name: string;
    rules: PropFirmRules;
    firm_name?: string;
    set_active?: boolean;
  }) {
    return handle<PropFirmProfileRecord>(
      await fetch(`${API_BASE_URL}/api/profiles/prop-firm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },

  async updatePropFirmProfile(
    id: number,
    payload: {
      name?: string;
      rules?: PropFirmRules;
      firm_name?: string;
      set_active?: boolean;
    },
  ) {
    return handle<PropFirmProfileRecord>(
      await fetch(`${API_BASE_URL}/api/profiles/prop-firm/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  },

  async activatePropFirmProfile(id: number) {
    return handle<PropFirmProfileRecord>(
      await fetch(`${API_BASE_URL}/api/profiles/prop-firm/${id}/activate`, { method: "POST" }),
    );
  },

  async deletePropFirmProfile(id: number) {
    return handle<{ success: boolean }>(
      await fetch(`${API_BASE_URL}/api/profiles/prop-firm/${id}`, { method: "DELETE" }),
    );
  },
};

export type TradingRunListResponse = {
  runs: TradingRunSummary[];
  total: number;
  limit: number;
  offset: number;
};

export const runsApi = {
  async list(options: { limit?: number; offset?: number; symbol?: string } = {}) {
    const { limit = 20, offset = 0, symbol } = options;
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (symbol) params.set("symbol", symbol);
    return handle<TradingRunListResponse>(
      await fetch(`${API_BASE_URL}/api/runs?${params.toString()}`, { cache: "no-store" }),
    );
  },

  async get(runId: number) {
    return handle<TradingRunDetail>(await fetch(`${API_BASE_URL}/api/runs/${runId}`, { cache: "no-store" }));
  },
};
