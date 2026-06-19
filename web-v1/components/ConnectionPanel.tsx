"use client";

import { useEffect, useState } from "react";
import { Button, Card, Dot, FieldLabel, Input } from "./ui";
import { useTradingWorkspace } from "@/components/workspace/TradingWorkspaceProvider";
import type { ConnectionStatus } from "@/lib/api";
import { api } from "@/lib/api";
import {
  tradingAccountModeDescription,
  tradingAccountModeLabel,
  tradingAccountModeShortLabel,
  type TradingAccountMode,
} from "@/lib/tradingAccount";

const SESSION_STORAGE_KEY = "thinktrade.mt5.session-login";
const PERSISTENT_STORAGE_KEY = "thinktrade.mt5.saved-login";

const ACCOUNT_MODES: TradingAccountMode[] = ["demo", "real", "prop_firm"];

type StoredConnectionPrefs = {
  login: string;
  server: string;
  remember: boolean;
};

function loadStoredConnectionPrefs(): StoredConnectionPrefs {
  if (typeof window === "undefined") {
    return { login: "", server: "", remember: true };
  }

  try {
    const sessionRaw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    const persistentRaw = window.localStorage.getItem(PERSISTENT_STORAGE_KEY);
    const raw = persistentRaw ?? sessionRaw;
    if (!raw) return { login: "", server: "", remember: true };

    const parsed = JSON.parse(raw) as Partial<StoredConnectionPrefs>;
    return {
      login: typeof parsed.login === "string" ? parsed.login : "",
      server: typeof parsed.server === "string" ? parsed.server : "",
      remember: parsed.remember !== false,
    };
  } catch {
    return { login: "", server: "", remember: true };
  }
}

function serverPlaceholder(mode: TradingAccountMode): string {
  if (mode === "real") return "Broker-Live-Server";
  if (mode === "prop_firm") return "PropFirm-Server";
  return "Demo-Server";
}

function StepIndicator({ step, connected }: { step: 1 | 2; connected: boolean }) {
  const items = [
    { n: 1, label: "Account type" },
    { n: 2, label: "MT5 connection" },
  ] as const;

  return (
    <div className="mb-6 flex items-center gap-2">
      {items.map((item, index) => {
        const done = connected || step > item.n;
        const active = !connected && step === item.n;
        return (
          <div key={item.n} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                  done
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : active
                    ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent),transparent_85%)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]"
                }`}
              >
                {done && !active ? "✓" : item.n}
              </span>
              <span
                className={`truncate text-sm font-medium ${
                  active || done ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                }`}
              >
                {item.label}
              </span>
            </div>
            {index < items.length - 1 && (
              <div
                className={`h-px min-w-[12px] flex-1 ${
                  done ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ConnectionPanel({
  status,
  onStatusChange,
  onInfo,
  onError,
  onConnected,
}: {
  status: ConnectionStatus | null;
  onStatusChange: (s: ConnectionStatus) => void;
  onInfo: (msg: string) => void;
  onError: (msg: string) => void;
  onConnected?: () => void;
}) {
  const { accountMode, setAccountMode } = useTradingWorkspace();
  const [storedPrefs] = useState(loadStoredConnectionPrefs);
  const [step, setStep] = useState<1 | 2>(1);
  const [login, setLogin] = useState(storedPrefs.login);
  const [password, setPassword] = useState("");
  const [server, setServer] = useState(storedPrefs.server);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(storedPrefs.remember);

  const connected = !!status?.connected;

  useEffect(() => {
    const payload: StoredConnectionPrefs = {
      login,
      server,
      remember: rememberLogin,
    };

    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
      if (rememberLogin) {
        window.localStorage.setItem(PERSISTENT_STORAGE_KEY, JSON.stringify(payload));
      } else {
        window.localStorage.removeItem(PERSISTENT_STORAGE_KEY);
      }
    } catch {
      /* ignore storage failures */
    }
  }, [login, server, rememberLogin]);

  const handleConnect = async () => {
    if (!login.trim() || !password || !server.trim()) {
      onError("Enter login, password, and server before connecting.");
      return;
    }
    setBusy(true);
    try {
      const r = await api.connect({ login, password, server });
      onStatusChange(r.data);
      if (r.success && r.data?.connected) {
        onInfo(r.message);
        onConnected?.();
      } else {
        (r.success ? onInfo : onError)(r.message);
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      const r = await api.disconnect();
      onStatusChange(r.data);
      onInfo(r.message);
      setStep(1);
      setPassword("");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    try {
      const s = await api.status();
      onStatusChange(s);
      onInfo("Status refreshed");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleContinueToConnect = () => {
    setStep(2);
  };

  const cardTitle = connected
    ? "Broker connected"
    : step === 1
    ? "Choose account type"
    : "Connect to MT5";

  const cardSubtitle = connected
    ? `${tradingAccountModeLabel(accountMode)} · session active`
    : step === 1
    ? "Step 1 of 2 — how ThinkTrade will treat this session"
    : `Step 2 of 2 — sign in with your ${tradingAccountModeShortLabel(accountMode).toLowerCase()} MT5 credentials`;

  return (
    <Card
      title={cardTitle}
      subtitle={cardSubtitle}
      icon={
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M7 12h.01M12 12h.01M17 12h.01" strokeLinecap="round" />
        </svg>
      }
      action={
        <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-0.5 text-[11px] text-[var(--muted)]">
          <Dot tone={connected ? "success" : "warning"} pulse={connected} />
          {connected ? "Connected" : `Step ${step}/2`}
        </div>
      }
    >
      <StepIndicator step={connected ? 2 : step} connected={connected} />

      {connected ? (
        <>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Account type
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
              {tradingAccountModeLabel(accountMode)}
            </div>
            <p className="mt-1 text-[11px] text-[var(--muted)]">{tradingAccountModeDescription(accountMode)}</p>
            {status?.account && typeof status.account === "object" && (
              <div className="mt-3 grid gap-1 text-xs text-[var(--muted)]">
                {"login" in status.account && status.account.login != null && (
                  <div>
                    Login: <span className="font-mono text-[var(--foreground)]">{String(status.account.login)}</span>
                  </div>
                )}
                {"server" in status.account && status.account.server != null && (
                  <div>
                    Server: <span className="font-mono text-[var(--foreground)]">{String(status.account.server)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="mt-4 text-[11px] text-[var(--muted)]">
            Disconnect to change account type or use different MT5 credentials.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={handleDisconnect}>
              Disconnect
            </Button>
            <Button variant="ghost" disabled={busy} onClick={handleRefresh}>
              Refresh status
            </Button>
          </div>
        </>
      ) : step === 1 ? (
        <>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Select the kind of account you are connecting. This cannot be mixed with other modes during a session.
          </p>
          <div className="grid gap-3 sm:grid-cols-1">
            {ACCOUNT_MODES.map((mode) => {
              const active = accountMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAccountMode(mode)}
                  className={`rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent),transparent_90%)] shadow-[0_0_0_1px_var(--accent)_inset]"
                      : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {tradingAccountModeLabel(mode)}
                    </span>
                    <span
                      className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                        active ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--border)]"
                      }`}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-[var(--muted)]">
                    {tradingAccountModeDescription(mode)}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={handleContinueToConnect}>
              Continue to connection
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
            <div className="text-sm text-[var(--foreground)]">
              Account type: <span className="font-medium">{tradingAccountModeLabel(accountMode)}</span>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Change type
            </button>
          </div>

          <div className="grid gap-3">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Login</FieldLabel>
              <Input
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                leading={
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" strokeLinecap="round" />
                  </svg>
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Password</FieldLabel>
              <div className="relative">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type={showPass ? "text" : "password"}
                  leading={
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="11" width="16" height="9" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  }
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-[var(--muted)] transition hover:text-[var(--foreground)]"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3l18 18" strokeLinecap="round" />
                      <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                      <path d="M9.88 4.6a10.5 10.5 0 0 1 2.12-.22c6 0 10 6 10 6a18.1 18.1 0 0 1-2.66 3.5" />
                      <path d="M6.1 6.1A17.8 17.8 0 0 0 2 10.38s4 6 10 6a10 10 0 0 0 4-.87" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Server</FieldLabel>
              <Input
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder={serverPlaceholder(accountMode)}
                leading={
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="6" rx="1.5" />
                    <rect x="3" y="14" width="18" height="6" rx="1.5" />
                    <path d="M7 7h.01M7 17h.01" strokeLinecap="round" />
                  </svg>
                }
              />
              <p className="text-[11px] text-[var(--muted)]">
                Use the exact server name from your broker or prop firm (MT5 Market Watch / account details).
              </p>
            </div>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 p-3 transition hover:border-[var(--border-strong)]">
            <input
              type="checkbox"
              checked={rememberLogin}
              onChange={(e) => setRememberLogin(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--border)] bg-[var(--surface-2)] accent-[var(--accent)]"
            />
            <div className="min-w-0">
              <div className="text-sm text-[var(--foreground)]">Remember login and server</div>
              <div className="text-[11px] text-[var(--muted)]">
                Keeps broker login and server in this browser. Password is not stored.
              </div>
            </div>
          </label>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="primary" loading={busy} disabled={busy} onClick={handleConnect}>
              {!busy && (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              Connect
            </Button>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--muted)]">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            Credentials are sent only to your local API. Password stays in memory until you disconnect.
          </p>
        </>
      )}
    </Card>
  );
}
