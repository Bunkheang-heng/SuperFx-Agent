"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";
import { api, type ProviderInfo, type RunCycleResult, type TradingMode, type TradingStrategy } from "@/lib/api";
import { isPropFirmRulesActive, propFirmRulesForApi, type PropFirmRules } from "@/lib/propFirm";
import { tradingAccountModeLabel } from "@/lib/tradingAccount";
import { runCycleStream } from "@/lib/sse";
import { PropFirmRulesPanel } from "@/components/PropFirmRulesPanel";
import { Badge, Button, Card, FieldLabel, Input } from "./ui";

const PROVIDER_META: Record<
  string,
  { label: string; description: string; iconBg: string; icon: string }
> = {
  sealion: {
    label: "SeaLion",
    description: "Southeast-Asia optimized",
    iconBg: "bg-[#2563eb]",
    icon: "S",
  },
  openai: {
    label: "OpenAI",
    description: "GPT family",
    iconBg: "bg-[#10b981]",
    icon: "O",
  },
  gemini: {
    label: "Gemini",
    description: "Google AI",
    iconBg: "bg-[#f59e0b]",
    icon: "G",
  },
};

const TRADING_MODE_META: Record<TradingMode, { label: string; description: string }> = {
  auto: {
    label: "Auto",
    description: "Adaptive professional style based on current conditions",
  },
  aggressive: {
    label: "Aggressive",
    description: "Must enter immediately with a market buy or sell decision",
  },
  scalper: {
    label: "Scalper",
    description: "Fast execution, tight entries, momentum-focused",
  },
  day_trader: {
    label: "Day Trader",
    description: "Intraday structure, cleaner setups, session-aware",
  },
  swing_trader: {
    label: "Swing Trader",
    description: "Higher patience, broader context, fewer but stronger setups",
  },
  breakout: {
    label: "Breakout",
    description: "Confirmation entries through expansion and continuation",
  },
  mean_reversion: {
    label: "Mean Reversion",
    description: "Fade extensions and seek value-zone pullbacks",
  },
};

const STRATEGY_META: Record<TradingStrategy, { label: string; description: string }> = {
  none: {
    label: "No Strategy Filter",
    description: "Let the model use the chosen trading mode without enforcing a named strategy framework.",
  },
  smc: {
    label: "SMC",
    description: "Smart Money Concepts with structure shifts, liquidity sweeps, order blocks, and FVG logic.",
  },
  ict: {
    label: "ICT",
    description: "Liquidity pools, dealing ranges, session timing, displacement, and fair value gap framing.",
  },
  supply_demand: {
    label: "Supply & Demand",
    description: "Trade around fresh zones, imbalance, and cleaner revisits instead of chasing poor locations.",
  },
  support_resistance: {
    label: "Support / Resistance",
    description: "Respect reaction levels, breakout behavior, and retest quality around important price zones.",
  },
  trend_following: {
    label: "Trend Following",
    description: "Prioritize continuation with the dominant direction and avoid low-quality countertrend fades.",
  },
  breakout_retest: {
    label: "Breakout Retest",
    description: "Wait for range expansion, follow-through, and cleaner retest structure before committing.",
  },
};

export function RunCyclePanel({
  onResult,
  onStreamToken,
  onStreamStatus,
  onStreamStart,
  onStreamEnd,
  onInfo,
  onError,
  propFirmRules,
  onPropFirmRulesChange,
  activeProfileId,
  hidePropFirmRules = false,
}: {
  onResult: (r: RunCycleResult) => void;
  onStreamToken: (t: string) => void;
  onStreamStatus: (s: string) => void;
  onStreamStart: () => void;
  onStreamEnd: () => void;
  onInfo: (m: string) => void;
  onError: (m: string) => void;
  propFirmRules: PropFirmRules;
  onPropFirmRulesChange: (rules: PropFirmRules) => void;
  activeProfileId?: number | null;
  hidePropFirmRules?: boolean;
}) {
  const { accountMode } = useTradingWorkspace();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState<string>("sealion");
  const [model, setModel] = useState<string>("");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [tradingMode, setTradingMode] = useState<TradingMode>("auto");
  const [tradingStrategy, setTradingStrategy] = useState<TradingStrategy>("none");
  const [userPrompt, setUserPrompt] = useState("");
  const [waitForNewCandle, setWaitForNewCandle] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [stopStream, setStopStream] = useState<null | (() => void)>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.providers();
        setProviders(r.providers);
        const preferred =
          r.providers.find((p) => p.provider === "sealion" && p.configured) ??
          r.providers.find((p) => p.provider === "sealion") ??
          r.providers.find((p) => p.configured) ??
          r.providers[0];
        if (preferred) {
          setProvider(preferred.provider);
          setModel(preferred.default_model);
        }
      } catch (e) {
        onError((e as Error).message);
      }
    })();
  }, [onError]);

  const currentProvider = providers.find((p) => p.provider === provider);
  const isPropFirmAccount = accountMode === "prop_firm";
  const apiPropFirmRules = isPropFirmAccount ? propFirmRulesForApi(propFirmRules) : undefined;
  const normalizedSymbol = symbol.trim();
  const normalizedUserPrompt = userPrompt.trim();
  const defaultModel = currentProvider?.default_model ?? "";
  const normalizedModel = model.trim();
  const effectiveModel = useCustomModel ? normalizedModel || defaultModel : defaultModel || normalizedModel;

  const handleProviderChange = (p: string) => {
    setProvider(p);
    const next = providers.find((x) => x.provider === p);
    if (next) {
      setModel(next.default_model);
      setUseCustomModel(false);
    }
  };

  const handleSymbolBlur = () => setSymbol((prev) => prev.trim());

  const handleStartTrading = () => {
    if (!provider) return onError("Select a provider first");
    if (!normalizedSymbol) return onError("Enter a trading symbol");
    if (isPropFirmAccount && !isPropFirmRulesActive(propFirmRules)) {
      return onError("Prop firm mode requires enabled rules. Open the Prop Firm Rules tab and enable them.");
    }
    if (streaming) return;
    onStreamStart();
    setStreaming(true);
    const stop = runCycleStream(
      {
        provider,
        model: effectiveModel || undefined,
        symbol: normalizedSymbol,
        waitForNewCandle,
        tradingMode,
        tradingStrategy,
        userPrompt: normalizedUserPrompt || undefined,
        accountMode,
        propFirmRules: apiPropFirmRules,
        propFirmProfileId: isPropFirmAccount ? (activeProfileId ?? undefined) : undefined,
      },
      {
        onStatus: (d) => onStreamStatus(d),
        onToken: (d) => onStreamToken(d),
        onDone: (data) => {
          if (data && typeof data === "object" && "decision" in (data as object)) {
            onResult(data as RunCycleResult);
          }
          onInfo("Trading cycle complete");
          setStreaming(false);
          setStopStream(null);
          onStreamEnd();
        },
        onError: (err) => {
          onError(err);
          setStreaming(false);
          setStopStream(null);
          onStreamEnd();
        },
      },
    );
    if (symbol !== normalizedSymbol) setSymbol(normalizedSymbol);
    setStopStream(() => stop);
  };

  const handleStop = () => {
    stopStream?.();
    setStreaming(false);
    setStopStream(null);
    onStreamEnd();
    onInfo("Trading stopped");
  };

  return (
    <Card
      title="Start Trading"
      subtitle="Pick a provider, choose a symbol, and run a live trading cycle"
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 3l14 9-14 9V3z" strokeLinejoin="round" />
        </svg>
      }
      action={
        currentProvider && (
          <Badge tone={currentProvider.configured ? "success" : "warning"}>
            <span className={`h-1.5 w-1.5 rounded-full ${currentProvider.configured ? "bg-[var(--success)]" : "bg-[var(--warning)]"}`} />
            {currentProvider.configured ? "Key configured" : "Key missing"}
          </Badge>
        )
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
        <div className="text-sm text-[var(--foreground)]">
          Account type:{" "}
          <span className="font-medium">{tradingAccountModeLabel(accountMode)}</span>
        </div>
        <Link href="/connection" className="text-xs font-medium text-[var(--accent)] hover:underline">
          Change on Connection
        </Link>
      </div>
      {isPropFirmAccount && !isPropFirmRulesActive(propFirmRules) && (
        <p className="mb-4 text-[11px] text-[var(--warning)]">
          Enable prop firm rules on the Prop Firm Rules tab before starting a cycle.
        </p>
      )}

      {/* Provider selection */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>AI Provider</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {providers.length === 0 &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-[74px]" />
            ))}
          {providers.map((p) => {
            const meta = PROVIDER_META[p.provider] ?? {
              label: p.provider,
              description: "Custom",
              iconBg: "bg-[var(--accent)]",
              icon: p.provider.charAt(0).toUpperCase(),
            };
            const active = provider === p.provider;
            return (
              <button
                key={p.provider}
                onClick={() => handleProviderChange(p.provider)}
                className={`group relative flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent),transparent_88%)] shadow-[0_0_0_1px_var(--accent)_inset]"
                    : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-md ${meta.iconBg} text-[11px] font-bold text-white`}
                    >
                      {meta.icon}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        active ? "text-[var(--foreground)]" : "text-[var(--foreground)]/90"
                      }`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      p.configured ? "bg-[var(--success)]" : "bg-[var(--warning)]"
                    }`}
                    title={p.configured ? "API key configured" : "API key missing"}
                  />
                </div>
                <span className="text-[11px] text-[var(--muted)]">{meta.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model selection */}
      <div className="mt-4 flex flex-col gap-1.5">
        <FieldLabel>Model</FieldLabel>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/60 p-1.5">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => {
                setUseCustomModel(false);
                if (defaultModel) setModel(defaultModel);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                !useCustomModel
                  ? "bg-[var(--surface-3)] text-[var(--foreground)] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Recommended
            </button>
            <button
              type="button"
              onClick={() => setUseCustomModel(true)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                useCustomModel
                  ? "bg-[var(--surface-3)] text-[var(--foreground)] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Custom override
            </button>
          </div>

          {!useCustomModel ? (
            <div className="mt-1.5 flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                  Default for {PROVIDER_META[provider]?.label ?? provider}
                </div>
                <div className="mt-0.5 truncate font-mono text-[13px] text-[var(--foreground)]">
                  {defaultModel || "No default model available"}
                </div>
              </div>
              <span className="hidden shrink-0 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)] sm:inline">
                auto
              </span>
            </div>
          ) : (
            <div className="mt-1.5">
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={defaultModel || "Enter model id"}
                className="font-mono"
              />
              <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                Override the provider&apos;s recommended default at your own risk.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Trading mode selection */}
      <div className="mt-4 flex flex-col gap-1.5">
        <FieldLabel>Trading Mode</FieldLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(TRADING_MODE_META).map(([value, meta]) => {
            const mode = value as TradingMode;
            const active = tradingMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setTradingMode(mode)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent),transparent_88%)] shadow-[0_0_0_1px_var(--accent)_inset]"
                    : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
                }`}
              >
                <div className="text-sm font-medium text-[var(--foreground)]">{meta.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{meta.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Strategy selection */}
      <div className="mt-4 flex flex-col gap-1.5">
        <FieldLabel>Strategy Framework</FieldLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(STRATEGY_META).map(([value, meta]) => {
            const strategy = value as TradingStrategy;
            const active = tradingStrategy === strategy;
            return (
              <button
                key={strategy}
                type="button"
                onClick={() => setTradingStrategy(strategy)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent),transparent_88%)] shadow-[0_0_0_1px_var(--accent)_inset]"
                    : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
                }`}
              >
                <div className="text-sm font-medium text-[var(--foreground)]">{meta.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">{meta.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {!hidePropFirmRules && (
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-[var(--foreground)]">Prop firm rules</div>
              <p className="text-[11px] text-[var(--muted)]">Optional funded-account constraints for this cycle</p>
            </div>
            <Link href="/prop-firm" className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline">
              Full editor
            </Link>
          </div>
          <PropFirmRulesPanel rules={propFirmRules} onChange={onPropFirmRulesChange} showPresets />
        </div>
      )}

      {/* User prompt */}
      <div className="mt-4 flex flex-col gap-1.5">
        <FieldLabel>Extra AI Context (Optional)</FieldLabel>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Example: Focus on London session momentum, avoid countertrend setups, and be stricter with risk."
          className="min-h-[88px] w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_oklab,var(--accent),transparent_72%)]"
          maxLength={1200}
        />
        <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
          <span>Add any custom instructions you want the AI to consider for this cycle.</span>
          <span>{normalizedUserPrompt.length}/1200</span>
        </div>
      </div>

      {/* Trading symbol */}
      <div className="mt-4 flex flex-col gap-1.5">
        <FieldLabel>Trading Symbol</FieldLabel>
        <p className="text-[11px] leading-snug text-[var(--muted)]">
          Enter the exact symbol name your broker supports (as shown in MT5 Market Watch).
        </p>
        <Input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          onBlur={handleSymbolBlur}
          placeholder="Enter trading symbol"
          className="font-mono uppercase"
          leading={
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" strokeLinecap="round" />
              <path d="M7 14l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        {symbol !== normalizedSymbol && (
          <span className="text-[11px] text-[var(--muted)]">
            Leading and trailing spaces will be trimmed automatically.
          </span>
        )}
      </div>

      {/* Options */}
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 p-3 transition hover:border-[var(--border-strong)]">
        <input
          type="checkbox"
          checked={waitForNewCandle}
          onChange={(e) => setWaitForNewCandle(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-[var(--border)] bg-[var(--surface-2)] accent-[var(--accent)]"
        />
        <div className="min-w-0">
          <div className="text-sm text-[var(--foreground)]">Wait for new candle</div>
          <div className="text-[11px] text-[var(--muted)]">
            Block until a fresh bar closes before running the cycle.
          </div>
        </div>
      </label>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant="primary"
          loading={streaming}
          disabled={streaming || !provider || !normalizedSymbol}
          onClick={handleStartTrading}
        >
          {!streaming && (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 3l14 9-14 9V3z" strokeLinejoin="round" />
            </svg>
          )}
          {streaming ? "Trading…" : "Start trading"}
        </Button>
        {streaming && (
          <Button variant="danger" onClick={handleStop}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
            Stop
          </Button>
        )}
      </div>
    </Card>
  );
}
