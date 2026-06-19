"use client";

import { AccountOverview } from "@/components/workspace/AccountOverview";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";

export default function Page() {
  const { status, refreshWorkspace } = useTradingWorkspace();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <AccountOverview status={status} onRefresh={refreshWorkspace} />
    </div>
  );
}
