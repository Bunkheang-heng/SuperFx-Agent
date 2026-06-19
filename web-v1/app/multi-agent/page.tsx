"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useMultiAgentDeskSession } from "@/components/multiAgent/MultiAgentDeskSessionHost";

export default function MultiAgentPage() {
  const deskSession = useMultiAgentDeskSession();
  const deskSlotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    deskSession.setMultiAgentActive(true);
    return () => deskSession.setMultiAgentActive(false);
  }, [deskSession]);

  useEffect(() => {
    deskSession.registerMultiAgentSlot(deskSlotRef.current);
    return () => deskSession.registerMultiAgentSlot(null);
  }, [deskSession]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 sm:px-5">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Multi-agent desk</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          General-purpose four-agent trading with its own saved symbol, timing, and API keys. For funded challenge
          rules and evaluation pacing, use the{" "}
          <Link href="/prop-firm" className="font-medium text-[var(--accent)] hover:underline">
            Prop firm desk
          </Link>{" "}
          instead — settings do not overlap.
        </p>
      </div>
      <div ref={deskSlotRef} className="min-h-[480px]" />
    </div>
  );
}
