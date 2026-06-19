"use client";

import { useEffect, useState } from "react";
import { api, type PositionInsightResponse, type ProviderInfo } from "@/lib/api";
import { Badge, Button, Card, Input, LiveValue, MetricTile, Select, Textarea } from "@/components/ui";
import { runPositionInsightStream } from "@/lib/sse";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";

type PositionRecord = Record<string, unknown>;

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function fmt(v: unknown, digits = 2): string {
  const n = asNumber(v);
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtPrice(v: unknown): string {
  const n = asNumber(v);
  if (n == null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 });
}

function fmtTime(v: unknown): string {
  const n = asNumber(v);
  if (n == null) return "—";
  return new Date(n * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getSide(position: PositionRecord): "buy" | "sell" | "unknown" {
  const raw = asNumber(position.type);
  if (raw === 0) return "buy";
  if (raw === 1) return "sell";
  return "unknown";
}

function getProfitTone(profit: number | null): "default" | "success" | "danger" {
  if (profit == null) return "default";
  return profit >= 0 ? "success" : "danger";
}

const DEFAULT_QUESTION = "What is the current risk on these open positions, and what should I watch right now?";

export default function PositionsPage() {
  const { status, onError, onInfo } = useTradingWorkspace();
  const positions = (((status?.positions as PositionRecord[] | undefined) ?? []).slice()).sort(
    (a, b) => (asNumber(b.time) ?? 0) - (asNumber(a.time) ?? 0),
  );
  const connected = !!status?.connected;
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState("sealion");
  const [model, setModel] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [asking, setAsking] = useState(false);
  const [insightStatus, setInsightStatus] = useState("");
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [stopInsightStream, setStopInsightStream] = useState<null | (() => void)>(null);
  const [insight, setInsight] = useState<PositionInsightResponse["result"] | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await api.providers();
        if (!active) return;
        setProviders(response.providers);
        const preferred =
          response.providers.find((item) => item.provider === "sealion" && item.configured) ??
          response.providers.find((item) => item.provider === "sealion") ??
          response.providers.find((item) => item.configured) ??
          response.providers[0];
        if (preferred) {
          setProvider(preferred.provider);
          setModel(preferred.default_model);
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : "Unable to load AI providers.");
      }
    })();

    return () => {
      active = false;
    };
  }, [onError]);

  const totalProfit = positions.reduce((sum, position) => sum + (asNumber(position.profit) ?? 0), 0);
  const totalVolume = positions.reduce((sum, position) => sum + (asNumber(position.volume) ?? 0), 0);
  const buyCount = positions.filter((position) => getSide(position) === "buy").length;
  const sellCount = positions.filter((position) => getSide(position) === "sell").length;
  const currentProvider = providers.find((item) => item.provider === provider);
  const defaultModel = currentProvider?.default_model ?? "";
  const effectiveModel = useCustomModel ? model.trim() || defaultModel : defaultModel || model.trim();

  const exposureSummary =
    positions.length === 0
      ? "No open trades to review."
      : `${positions.length} open trade${positions.length > 1 ? "s" : ""} · ${buyCount} buy / ${sellCount} sell · ${totalProfit >= 0 ? "+" : ""}${fmt(totalProfit)} unrealized`;

  const handleAskInsight = async () => {
    if (!connected) return onError("Connect MT5 first.");
    if (positions.length === 0) return onError("There are no open positions to analyze.");
    if (!provider) return onError("Select an AI provider first.");
    if (!question.trim()) return onError("Ask a question about the current positions.");

    setAsking(true);
    setInsight(null);
    setInsightStatus("Preparing position insight...");
    setStreamedAnswer("");

    const stop = runPositionInsightStream(
      {
        provider,
        model: effectiveModel || undefined,
        question: question.trim(),
      },
      {
        onStatus: (statusText) => setInsightStatus(statusText),
        onToken: (token) => setStreamedAnswer((prev) => prev + token),
        onDone: (data) => {
          const result = data as PositionInsightResponse["result"];
          setInsight(result);
          setStreamedAnswer(result?.answer ?? "");
          setInsightStatus("Insight complete");
          setStopInsightStream(null);
          setAsking(false);
          onInfo("AI position insight ready.");
        },
        onError: (error) => {
          setInsightStatus("Insight failed");
          setStopInsightStream(null);
          setAsking(false);
          onError(error || "Unable to analyze the current positions.");
        },
      },
    );

    setStopInsightStream(() => stop);
  };

  const handleStopInsight = () => {
    stopInsightStream?.();
    setStopInsightStream(null);
    setAsking(false);
    setInsightStatus("Insight stream stopped");
    onInfo("Position insight stream stopped.");
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <MetricTile label="Open Trades" value={<LiveValue value={positions.length} display={String(positions.length)} />} />
        <MetricTile label="Total Volume" value={<LiveValue value={totalVolume} display={fmt(totalVolume, 2)} />} />
        <MetricTile
          label="Net P/L"
          tone={totalProfit >= 0 ? "success" : "danger"}
          value={<LiveValue value={totalProfit} display={totalProfit >= 0 ? `+${fmt(totalProfit)}` : fmt(totalProfit)} />}
        />
        <MetricTile label="Bias" value={`${buyCount} buy / ${sellCount} sell`} tone={buyCount !== sellCount ? "accent" : "default"} />
      </div>

      {positions.length === 0 ? (
        <Card
          title="No Open Positions"
          subtitle="Once the terminal has active trades, they will appear here automatically."
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19h16M7 15l3-3 3 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 19V9M13 19v-6M17 19v-9" strokeLinecap="round" />
            </svg>
          }
        >
          <div className="text-sm text-[var(--muted)]">Connect MT5 and open a trade to populate this view.</div>
        </Card>
      ) : (
        <Card
          title="Live Position Monitor"
          subtitle="Compact terminal-style list of all currently open trades."
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19h16M7 15l3-3 3 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 19V9M13 19v-6M17 19v-9" strokeLinecap="round" />
            </svg>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{positions.length} open</Badge>
              <Badge tone={totalProfit >= 0 ? "success" : "danger"}>
                Net {totalProfit >= 0 ? `+${fmt(totalProfit)}` : fmt(totalProfit)}
              </Badge>
            </div>
          }
          className="overflow-hidden"
          padded={false}
        >
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full border-collapse">
              <thead>
                <tr className="border-y border-[var(--border)] bg-[var(--surface-3)] text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                  <th className="px-3 py-2 text-left font-semibold">Symbol</th>
                  <th className="px-3 py-2 text-left font-semibold">Ticket</th>
                  <th className="px-3 py-2 text-left font-semibold">Time</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-right font-semibold">Volume</th>
                  <th className="px-3 py-2 text-right font-semibold">Price</th>
                  <th className="px-3 py-2 text-right font-semibold">S / L</th>
                  <th className="px-3 py-2 text-right font-semibold">T / P</th>
                  <th className="px-3 py-2 text-right font-semibold">Price</th>
                  <th className="px-3 py-2 text-right font-semibold">Profit</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position, index) => {
                  const side = getSide(position);
                  const profit = asNumber(position.profit);
                  const ticket = position.ticket ?? position.position_id ?? `position-${index}`;
                  const symbol = String(position.symbol ?? "—").toLowerCase();
                  const profitTone = getProfitTone(profit);

                  return (
                    <tr
                      key={String(ticket)}
                      className="border-b border-[var(--border)]/70 bg-[var(--surface)]/35 text-[12px] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-2)]/75"
                    >
                      <td className="px-3 py-2 font-medium text-[var(--foreground)]">{symbol}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--muted)]">{String(ticket)}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--muted)]">{fmtTime(position.time)}</td>
                      <td
                        className={`px-3 py-2 font-medium ${
                          side === "buy"
                            ? "text-[var(--success)]"
                            : side === "sell"
                              ? "text-[var(--danger)]"
                              : "text-[var(--foreground)]"
                        }`}
                      >
                        {side}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(position.volume, 2)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtPrice(position.price_open)}</td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--danger)]">{fmtPrice(position.sl)}</td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--success)]">{fmtPrice(position.tp)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtPrice(position.price_current)}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          profitTone === "success"
                            ? "text-[var(--success)]"
                            : profitTone === "danger"
                              ? "text-[var(--danger)]"
                              : "text-[var(--foreground)]"
                        }`}
                      >
                        <LiveValue
                          value={profit}
                          display={profit == null ? "—" : profit >= 0 ? `+${fmt(profit)}` : fmt(profit)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[11px] text-[var(--muted)]">
            <div className="flex flex-wrap items-center gap-4">
              <span>Buy positions: {buyCount}</span>
              <span>Sell positions: {sellCount}</span>
              <span>Holding window: live</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span>Total volume: {fmt(totalVolume, 2)}</span>
              <span className={totalProfit >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                Total profit: {totalProfit >= 0 ? `+${fmt(totalProfit)}` : fmt(totalProfit)}
              </span>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="AI Position Desk"
        subtitle="Ask the model about the open trades currently held in MT5, together with the live market backdrop."
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3a7 7 0 0 0-7 7v2l-2 3h18l-2-3v-2a7 7 0 0 0-7-7Z" strokeLinejoin="round" />
            <path d="M9 19a3 3 0 0 0 6 0" strokeLinecap="round" />
          </svg>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={positions.length > 0 ? "info" : "warning"}>{exposureSummary}</Badge>
          </div>
        }
        className="overflow-hidden"
        padded={false}
      >
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
          <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Provider
                </div>
                <Select
                  value={provider}
                  onChange={(event) => {
                    const nextProvider = event.target.value;
                    setProvider(nextProvider);
                    const next = providers.find((item) => item.provider === nextProvider);
                    if (next) {
                      setModel(next.default_model);
                      setUseCustomModel(false);
                    }
                  }}
                >
                  {providers.map((item) => (
                    <option key={item.provider} value={item.provider}>
                      {item.provider} {item.configured ? "" : "(key missing)"}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Model
                </div>
                <div className="grid gap-2">
                  <Select
                    value={useCustomModel ? "custom" : "default"}
                    onChange={(event) => setUseCustomModel(event.target.value === "custom")}
                  >
                    <option value="default">Use recommended model</option>
                    <option value="custom">Custom model</option>
                  </Select>
                  {useCustomModel ? (
                    <Input
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder={defaultModel || "Enter model id"}
                      className="font-mono"
                    />
                  ) : (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm text-[var(--foreground)]">
                      {defaultModel || "No default model available"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/55 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Good Prompts
              </div>
              <div className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
                <div>Ask about risk, holding quality, stop-loss placement, exposure concentration, market structure, or what could invalidate the trades.</div>
                <div className="font-mono text-[12px] text-[var(--foreground)]/85">
                  Example: &quot;Given the current market structure, which of these positions is weakest and why?&quot;
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Your Question
            </div>
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask the AI about your currently open positions..."
              className="min-h-[116px]"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={handleAskInsight} loading={asking} disabled={!connected || positions.length === 0 || asking}>
              Stream AI Position Insight
            </Button>
            <Button variant="ghost" onClick={() => setQuestion(DEFAULT_QUESTION)}>
              Use Suggested Question
            </Button>
            {asking && (
              <Button variant="danger" onClick={handleStopInsight}>
                Stop Stream
              </Button>
            )}
          </div>
        </div>

        <div className="px-5 py-5">
          {insight || streamedAnswer ? (
            <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/55 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{insight?.provider ?? provider}</Badge>
                  <Badge tone="accent">{(insight?.model ?? effectiveModel) || "default"}</Badge>
                  <Badge tone={asking ? "accent" : "success"}>{asking ? "streaming" : "ready"}</Badge>
                </div>
                <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Last Question
                </div>
                <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3 text-sm leading-relaxed text-[var(--foreground)]">
                  {insight?.question ?? question}
                </div>
                <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Stream Status
                </div>
                <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 px-3 py-2 text-sm text-[var(--muted)]">
                  {insightStatus || "Waiting to start"}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  AI Insight
                </div>
                <div className="mt-3 whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 font-mono text-sm leading-7 text-[var(--foreground)]/92">
                  {streamedAnswer || insight?.answer}
                  {asking && <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 rounded-sm bg-[var(--accent-2)] animate-blink" />}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/35 px-6 py-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--accent-2)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3a7 7 0 0 0-7 7v2l-2 3h18l-2-3v-2a7 7 0 0 0-7-7Z" strokeLinejoin="round" />
                  <path d="M9 19a3 3 0 0 0 6 0" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">No AI insight yet</div>
                <div className="mt-1 text-sm text-[var(--muted)]">
                  Ask the model to review the live open positions together with the current market context, explain the risk, or point out which trade deserves the most attention.
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

