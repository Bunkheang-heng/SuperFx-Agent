import type { MultiAgentRunResult } from "./multiAgent";

/** Keeps browser RAM bounded when the API returns huge prompts/snapshots. */
const MAX_AGENT_PROMPT_CHARS = 48_000;
const MAX_AGENT_OUTPUT_CHARS = 56_000;
const MAX_SNAPSHOT_CANDLES_UI = 18;

export function truncateWithNotice(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.58);
  const tail = maxChars - head - 48;
  const omitted = text.length - head - tail;
  return `${text.slice(0, head)}\n...[truncated ${omitted} characters for UI memory cap]...\n${text.slice(-tail)}`;
}

export function slimSnapshotForUi(snapshot: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...snapshot };
  const rc = out.recent_candles;
  if (Array.isArray(rc) && rc.length > MAX_SNAPSHOT_CANDLES_UI) {
    out.recent_candles = rc.slice(-MAX_SNAPSHOT_CANDLES_UI);
    out.recent_candles_note = `showing last ${MAX_SNAPSHOT_CANDLES_UI} of ${rc.length}`;
  }
  const candles = out.candles;
  if (Array.isArray(candles) && candles.length > MAX_SNAPSHOT_CANDLES_UI) {
    delete out.candles;
    out.candles_omitted_count = candles.length;
  }
  return out;
}

export function slimMultiAgentRunResultForUi(result: MultiAgentRunResult): MultiAgentRunResult {
  const snapshot =
    result.snapshot && typeof result.snapshot === "object"
      ? slimSnapshotForUi(result.snapshot as Record<string, unknown>)
      : result.snapshot;
  return {
    ...result,
    snapshot,
    agents: result.agents.map((a) => ({
      ...a,
      prompt: truncateWithNotice(a.prompt ?? "", MAX_AGENT_PROMPT_CHARS),
      output: truncateWithNotice(a.output ?? "", MAX_AGENT_OUTPUT_CHARS),
    })),
  };
}
