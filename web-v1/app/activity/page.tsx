"use client";

import { LogsPanel } from "@/components/LogsPanel";
import { DecisionPanel } from "@/components/DecisionPanel";
import { StreamPanel } from "@/components/StreamPanel";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";

export default function ActivityPage() {
  const { result, streamStatus, streamTokens, streaming, clearStream, onError } = useTradingWorkspace();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.95fr]">
        <LogsPanel onError={onError} />
        <div className="flex flex-col gap-6">
          <DecisionPanel result={result} />
          <StreamPanel
            status={streamStatus}
            tokens={streamTokens}
            streaming={streaming}
            onClear={clearStream}
          />
        </div>
      </div>
    </div>
  );
}
