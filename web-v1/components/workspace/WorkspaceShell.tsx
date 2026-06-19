"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { Badge, Dot } from "@/components/ui";
import { ToastStack } from "@/components/Toast";
import { useMultiAgentDeskSessionOptional } from "@/components/multiAgent/MultiAgentDeskSessionHost";
import { NavTabBar, NavTabLink } from "@/components/NavTabs";
import { tradingAccountModeShortLabel } from "@/lib/tradingAccount";
import { useTradingWorkspace } from "./TradingWorkspaceProvider";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Overview",
    description: "Summary and live status",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 13h6V4H4v9zm10 7h6V4h-6v16zM4 20h6v-3H4v3z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/connection",
    label: "Connection",
    description: "Broker login and account state",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 12h.01M12 12h.01M17 12h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/trade",
    label: "Trading",
    description: "Start trading and inspect live output",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 3l14 9-14 9V3z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/multi-agent",
    label: "Multi-Agent",
    description: "4 collaborating AIs with your own keys",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="6" cy="12" r="2.4" />
        <circle cx="12" cy="6" r="2.4" />
        <circle cx="18" cy="12" r="2.4" />
        <circle cx="12" cy="18" r="2.4" />
        <path d="M8 11l3-3M14 8l3 3M14 16l3-3M8 13l3 3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/prop-firm",
    label: "Prop Firm",
    description: "Funded account rules for the AI desk",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l8 4v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" strokeLinejoin="round" />
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/positions",
    label: "Positions",
    description: "Track live open trades",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19h16M7 15l3-3 3 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 19V9M13 19v-6M17 19v-9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    description: "Review executed trade history",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/runs",
    label: "Runs",
    description: "SQLite audit log and compliance history",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/activity",
    label: "Activity",
    description: "Logs and latest decisions",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
] as const;

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Overview", subtitle: "MT5 account identity, balance, equity, and margin" },
  "/connection": { title: "Connection", subtitle: "Broker connectivity, account details, and refresh controls" },
  "/trade": { title: "Trading", subtitle: "Prompt execution, streaming output, and last decision" },
  "/multi-agent": {
    title: "Multi-Agent",
    subtitle: "Four collaborating AIs (analyst, strategist, risk manager, team lead) trading together",
  },
  "/prop-firm": {
    title: "Prop Firm",
    subtitle: "Funded account and evaluation rules injected into every AI agent",
  },
  "/runs": {
    title: "Runs",
    subtitle: "SQLite audit trail of trading cycles and compliance checks",
  },
  "/positions": { title: "Positions", subtitle: "Live open trades with full position detail" },
  "/history": { title: "History", subtitle: "Executed trade history from the MT5 terminal" },
  "/activity": { title: "Activity", subtitle: "Recent engine events, logs, and execution feedback" },
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status, apiOnline, accountMode, toasts, dismissToast } = useTradingWorkspace();
  const deskSession = useMultiAgentDeskSessionOptional();
  const page = PAGE_META[pathname] ?? { title: "ThinkTrade", subtitle: "AI trading workspace" };
  const connected = !!status?.connected;

  if (!connected) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <header className="border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 py-5 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <BrandLogo size={44} className="shadow-[0_8px_24px_-8px_rgba(30,158,232,0.5)]" />
            <div>
              <h1 className="text-base font-semibold tracking-tight text-brand-gradient">ThinkTrade</h1>
              <p className="text-xs text-[var(--muted)]">Connect your MT5 account to continue</p>
            </div>
          </div>
        </header>
        <main className="px-4 py-8 sm:px-6">{children}</main>
        <ToastStack items={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden h-svh w-72 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl lg:flex">
          <div className="shrink-0 border-b border-[var(--border)] px-6 py-5">
            <div className="flex items-center gap-3">
              <BrandLogo size={44} className="shadow-[0_10px_28px_-10px_rgba(30,158,232,0.45)]" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold tracking-tight text-brand-gradient">ThinkTrade</h1>
                  <Badge tone={accountMode === "prop_firm" ? "accent" : accountMode === "real" ? "warning" : "info"}>
                    {tradingAccountModeShortLabel(accountMode).toUpperCase()}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">Multi-page AI trading workspace</p>
              </div>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Navigation
            </div>
            <div className="space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-sidebar-link group ${active ? "nav-sidebar-link-active" : ""}`}
                  >
                    <span className="nav-sidebar-icon">{item.icon}</span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-medium ${
                          active ? "text-[var(--foreground)]" : "text-[var(--foreground)]/90"
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted)] group-hover:text-[var(--muted)]">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-72">
          <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl">
            <div className="px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    ThinkTrade Workspace
                  </div>
                  <div className="mt-1 text-xl font-semibold tracking-tight text-[var(--foreground)]">
                    {page.title}
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">{page.subtitle}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={apiOnline ? "success" : apiOnline === false ? "danger" : "default"}>
                    <Dot tone={apiOnline ? "success" : apiOnline === false ? "danger" : "muted"} pulse={!!apiOnline} />
                    API {apiOnline ? "online" : apiOnline === false ? "offline" : "checking"}
                  </Badge>
                  <Badge tone={connected ? "success" : "warning"}>
                    <Dot tone={connected ? "success" : "warning"} pulse={connected} />
                    MT5 {connected ? "connected" : "disconnected"}
                  </Badge>
                  <Badge tone={accountMode === "prop_firm" ? "accent" : accountMode === "real" ? "warning" : "info"}>
                    {tradingAccountModeShortLabel(accountMode)} account
                  </Badge>
                  {deskSession?.isLive && (
                    <Badge tone="accent">
                      <Dot tone="accent" pulse />
                      AI desk live
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-4 overflow-x-auto pb-1 lg:hidden">
                <NavTabBar className="min-w-max">
                  {NAV_ITEMS.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <NavTabLink key={item.href} href={item.href} active={active}>
                        {item.label}
                      </NavTabLink>
                    );
                  })}
                </NavTabBar>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>

          <footer className="border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-4 backdrop-blur-sm sm:px-6">
            <div className="flex flex-col items-center justify-between gap-2 text-[11px] text-[var(--muted)] sm:flex-row">
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand-green-bright)]" />
                <span>ThinkTrade workspace · Professional multi-page trading UI</span>
              </div>
              <div className="flex items-center gap-3">
                <span>© {new Date().getFullYear()} ThinkTrade</span>
                <span className="text-[var(--muted-2)]">·</span>
                <span>{tradingAccountModeShortLabel(accountMode)} account session</span>
              </div>
            </div>
          </footer>
      </div>

      <ToastStack items={toasts} onDismiss={dismissToast} />
    </div>
  );
}
