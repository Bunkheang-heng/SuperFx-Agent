"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, type ConnectionStatus, type RunCycleResult } from "@/lib/api";
import { type Toast } from "@/components/Toast";
import {
  loadTradingAccountMode,
  saveTradingAccountMode,
  type TradingAccountMode,
} from "@/lib/tradingAccount";

type TradingWorkspaceContextValue = {
  status: ConnectionStatus | null;
  setStatus: (status: ConnectionStatus | null) => void;
  /** True after the first broker/API status check has finished. */
  connectionReady: boolean;
  apiOnline: boolean | null;
  result: RunCycleResult | null;
  setResult: (result: RunCycleResult | null) => void;
  streamStatus: string;
  streamTokens: string;
  streaming: boolean;
  onStreamStart: () => void;
  onStreamEnd: () => void;
  onStreamStatus: (status: string) => void;
  onStreamToken: (token: string) => void;
  clearStream: () => void;
  onInfo: (message: string) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  refreshWorkspace: () => Promise<void>;
  accountMode: TradingAccountMode;
  setAccountMode: (mode: TradingAccountMode) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
};

const TradingWorkspaceContext = createContext<TradingWorkspaceContextValue | null>(null);

export function TradingWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [connectionReady, setConnectionReady] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [result, setResult] = useState<RunCycleResult | null>(null);

  const [streamStatus, setStreamStatus] = useState("");
  const [streamTokens, setStreamTokens] = useState("");
  const [streaming, setStreaming] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [accountMode, setAccountModeState] = useState<TradingAccountMode>("demo");

  const setAccountMode = useCallback((mode: TradingAccountMode) => {
    setAccountModeState(mode);
    saveTradingAccountMode(mode);
  }, []);

  useEffect(() => {
    setAccountModeState(loadTradingAccountMode());
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((arr) => arr.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastId.current;
    setToasts((arr) => [...arr, { id, kind, text }]);
    setTimeout(() => {
      setToasts((arr) => arr.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const onInfo = useCallback((message: string) => pushToast("info", message), [pushToast]);
  const onSuccess = useCallback((message: string) => pushToast("success", message), [pushToast]);
  const onError = useCallback((message: string) => pushToast("error", message), [pushToast]);

  const refreshStatus = useCallback(async () => {
    try {
      const nextStatus = await api.status();
      setStatus(nextStatus);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    try {
      await api.health();
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }

    await refreshStatus();
    setConnectionReady(true);
  }, [refreshStatus]);

  useEffect(() => {
    const kickoff = setTimeout(() => {
      void refreshWorkspace();
    }, 0);
    return () => clearTimeout(kickoff);
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!status?.connected) {
      return;
    }

    const id = setInterval(() => {
      void refreshStatus();
    }, 2000);

    return () => clearInterval(id);
  }, [status?.connected, refreshStatus]);

  const clearStream = useCallback(() => {
    setStreamStatus("");
    setStreamTokens("");
  }, []);

  const onStreamStart = useCallback(() => {
    setStreaming(true);
    setStreamStatus("");
    setStreamTokens("");
  }, []);

  const onStreamEnd = useCallback(() => {
    setStreaming(false);
    void refreshStatus();
  }, [refreshStatus]);

  const onStreamStatus = useCallback((nextStatus: string) => {
    setStreamStatus(nextStatus);
  }, []);

  const onStreamToken = useCallback((token: string) => {
    setStreamTokens((prev) => prev + token);
  }, []);

  const value = useMemo<TradingWorkspaceContextValue>(
    () => ({
      status,
      setStatus,
      connectionReady,
      apiOnline,
      result,
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
      onSuccess,
      onError,
      refreshWorkspace,
      accountMode,
      setAccountMode,
      toasts,
      dismissToast,
    }),
    [
      status,
      connectionReady,
      apiOnline,
      result,
      streamStatus,
      streamTokens,
      streaming,
      onStreamStart,
      onStreamEnd,
      onStreamStatus,
      onStreamToken,
      clearStream,
      onInfo,
      onSuccess,
      onError,
      refreshWorkspace,
      accountMode,
      setAccountMode,
      toasts,
      dismissToast,
    ],
  );

  return <TradingWorkspaceContext.Provider value={value}>{children}</TradingWorkspaceContext.Provider>;
}

export function useTradingWorkspace() {
  const context = useContext(TradingWorkspaceContext);
  if (!context) {
    throw new Error("useTradingWorkspace must be used within TradingWorkspaceProvider");
  }
  return context;
}
