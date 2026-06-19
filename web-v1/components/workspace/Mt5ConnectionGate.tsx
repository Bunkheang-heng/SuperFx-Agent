"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTradingWorkspace } from "./TradingWorkspaceProvider";

const CONNECTION_PATH = "/connection";

function GateLoading({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--background)] px-6 text-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--brand-blue)]" />
      <p className="text-sm text-[var(--muted)]">{message}</p>
    </div>
  );
}

export function Mt5ConnectionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, connectionReady } = useTradingWorkspace();

  const connected = !!status?.connected;
  const onConnectionPage = pathname === CONNECTION_PATH;

  useEffect(() => {
    if (!connectionReady) return;
    if (!connected && !onConnectionPage) {
      router.replace(CONNECTION_PATH);
    }
  }, [connectionReady, connected, onConnectionPage, router]);

  if (!connectionReady) {
    return <GateLoading message="Checking MT5 connection…" />;
  }

  if (!connected && !onConnectionPage) {
    return <GateLoading message="Redirecting to broker connection…" />;
  }

  return children;
}
