"use client";

import { useRouter } from "next/navigation";
import { ConnectionPanel } from "@/components/ConnectionPanel";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";

export default function ConnectionPage() {
  const router = useRouter();
  const { status, setStatus, onSuccess, onError } = useTradingWorkspace();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <ConnectionPanel
        status={status}
        onStatusChange={setStatus}
        onInfo={onSuccess}
        onError={onError}
        onConnected={() => router.replace("/")}
      />
    </div>
  );
}
