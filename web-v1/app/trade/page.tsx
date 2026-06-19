"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RunCyclePanel } from "@/components/RunCyclePanel";
import { StreamPanel } from "@/components/StreamPanel";
import { PropFirmRulesPanel } from "@/components/PropFirmRulesPanel";
import { NavTab, NavTabBar } from "@/components/NavTabs";
import { Card } from "@/components/ui";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";
import { usePropFirmRules } from "@/lib/usePropFirmRules";

type TradeTab = "run" | "prop-firm" | "stream";

export default function TradePage() {
  const {
    setResult,
    streamStatus,
    streamTokens,
    streaming,
    onStreamStart,
    onStreamEnd,
    onStreamStatus,
    onStreamToken,
    clearStream,
    onInfo,
    onError,
    accountMode,
  } = useTradingWorkspace();
  const { rules, setRules, activeProfileId } = usePropFirmRules();
  const [activeTab, setActiveTab] = useState<TradeTab>("run");
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    if (streaming && !wasStreamingRef.current) {
      setActiveTab("stream");
    }
    wasStreamingRef.current = streaming;
  }, [streaming]);

  const isPropFirmAccount = accountMode === "prop_firm";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <NavTabBar>
        <NavTab active={activeTab === "run"} onClick={() => setActiveTab("run")}>
          Start Trading
        </NavTab>
        {isPropFirmAccount && (
          <NavTab active={activeTab === "prop-firm"} onClick={() => setActiveTab("prop-firm")}>
            Prop Firm Rules
          </NavTab>
        )}
        <NavTab active={activeTab === "stream"} onClick={() => setActiveTab("stream")}>
          Live Stream
          {streaming && activeTab !== "stream" && (
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
          )}
        </NavTab>
      </NavTabBar>

      {activeTab === "run" && (
        <RunCyclePanel
          propFirmRules={rules}
          onPropFirmRulesChange={setRules}
          activeProfileId={activeProfileId}
          hidePropFirmRules
          onResult={setResult}
          onStreamStart={onStreamStart}
          onStreamEnd={onStreamEnd}
          onStreamStatus={onStreamStatus}
          onStreamToken={onStreamToken}
          onInfo={onInfo}
          onError={onError}
        />
      )}

      {activeTab === "prop-firm" && isPropFirmAccount && (
        <Card
          title="Prop firm rules"
          subtitle="Funded-account constraints apply only when Account type is Prop firm / funded on Connection."
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <p className="text-sm text-[var(--muted)]">
              Demo and real accounts ignore these rules. Change account type on the Connection page if needed.
            </p>
            <Link href="/prop-firm" className="shrink-0 text-xs font-medium text-[var(--accent)] hover:underline">
              Full editor & desk
            </Link>
          </div>
          <PropFirmRulesPanel rules={rules} onChange={setRules} showPresets />
        </Card>
      )}

      {activeTab === "stream" && (
        <StreamPanel
          status={streamStatus}
          tokens={streamTokens}
          streaming={streaming}
          onClear={clearStream}
        />
      )}
    </div>
  );
}
