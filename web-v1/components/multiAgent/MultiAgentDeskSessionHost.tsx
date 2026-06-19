"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MultiAgentDeskPage, type MultiAgentDeskPageProps } from "@/components/multiAgent/MultiAgentDeskPage";
import type { DeskMode } from "@/lib/multiAgent";

export type PropFirmDeskTab = "rules" | "desk" | "floor";

type DeskRoute =
  | { kind: "none" }
  | { kind: "multi_agent" }
  | { kind: "prop_firm"; tab: PropFirmDeskTab };

type MultiAgentDeskSessionContextValue = {
  isLive: boolean;
  statusLine: string;
  setPropFirmTab: (tab: PropFirmDeskTab) => void;
  setMultiAgentActive: (active: boolean) => void;
  registerPropFirmSlot: (el: HTMLElement | null) => void;
  registerMultiAgentSlot: (el: HTMLElement | null) => void;
};

const MultiAgentDeskSessionContext = createContext<MultiAgentDeskSessionContextValue | null>(null);

export function useMultiAgentDeskSession() {
  const ctx = useContext(MultiAgentDeskSessionContext);
  if (!ctx) {
    throw new Error("useMultiAgentDeskSession must be used within MultiAgentDeskSessionHost");
  }
  return ctx;
}

export function useMultiAgentDeskSessionOptional() {
  return useContext(MultiAgentDeskSessionContext);
}

function deskPropsForRoute(route: DeskRoute): MultiAgentDeskPageProps | null {
  if (route.kind === "multi_agent") {
    return { variant: "standard", deskSection: "setup", viewMode: "full" };
  }
  if (route.kind === "prop_firm") {
    if (route.tab === "floor") {
      return { variant: "prop_firm", deskSection: "floor", viewMode: "floor_only" };
    }
    return { variant: "prop_firm", deskSection: "setup", viewMode: "full" };
  }
  return null;
}

function MultiAgentDeskSessionEngine({
  route,
  onRuntimeChange,
}: {
  route: DeskRoute;
  onRuntimeChange: (live: boolean, statusLine: string) => void;
}) {
  const props = deskPropsForRoute(route);
  if (!props) return null;

  return (
    <MultiAgentDeskPage
      {...props}
      disableUnmountStop
      onRuntimeChange={onRuntimeChange}
    />
  );
}

export function MultiAgentDeskSessionHost({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<DeskRoute>({ kind: "none" });
  const [isLive, setIsLive] = useState(false);
  const [statusLine, setStatusLine] = useState("");
  const [propFirmTab, setPropFirmTab] = useState<PropFirmDeskTab>("rules");
  const [propFirmSlot, setPropFirmSlot] = useState<HTMLElement | null>(null);
  const [multiAgentSlot, setMultiAgentSlot] = useState<HTMLElement | null>(null);
  const fallbackHostRef = useRef<HTMLDivElement | null>(null);
  const [fallbackReady, setFallbackReady] = useState(false);

  const handleRuntimeChange = useCallback((live: boolean, line: string) => {
    setIsLive(live);
    setStatusLine(line);
  }, []);

  const isLiveRef = useRef(isLive);
  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  const setPropFirmTabSafe = useCallback((tab: PropFirmDeskTab) => {
    setPropFirmTab(tab);
    setRoute((prev) => {
      if (prev.kind === "prop_firm") return { kind: "prop_firm", tab };
      return prev;
    });
  }, []);

  const setMultiAgentActive = useCallback((active: boolean) => {
    if (active) {
      setRoute({ kind: "multi_agent" });
      return;
    }
    if (!isLiveRef.current) {
      setRoute((prev) => (prev.kind === "multi_agent" ? { kind: "none" } : prev));
    }
  }, []);

  const registerPropFirmSlot = useCallback(
    (el: HTMLElement | null) => {
      setPropFirmSlot(el);
      if (el) {
        setRoute({ kind: "prop_firm", tab: propFirmTab });
        return;
      }
      if (!isLiveRef.current) {
        setRoute((prev) => (prev.kind === "prop_firm" ? { kind: "none" } : prev));
      }
    },
    [propFirmTab],
  );

  const registerMultiAgentSlot = useCallback((el: HTMLElement | null) => {
    setMultiAgentSlot(el);
    if (el) {
      setRoute({ kind: "multi_agent" });
      return;
    }
    if (!isLiveRef.current) {
      setRoute((prev) => (prev.kind === "multi_agent" ? { kind: "none" } : prev));
    }
  }, []);

  useEffect(() => {
    if (route.kind === "prop_firm") {
      setRoute({ kind: "prop_firm", tab: propFirmTab });
    }
  }, [propFirmTab, route.kind]);

  const portalTarget = useMemo(() => {
    if (route.kind === "prop_firm" && propFirmSlot) return propFirmSlot;
    if (route.kind === "multi_agent" && multiAgentSlot) return multiAgentSlot;
    return fallbackHostRef.current;
  }, [route.kind, propFirmSlot, multiAgentSlot]);

  const ctxValue = useMemo<MultiAgentDeskSessionContextValue>(
    () => ({
      isLive,
      statusLine,
      setPropFirmTab: setPropFirmTabSafe,
      setMultiAgentActive,
      registerPropFirmSlot,
      registerMultiAgentSlot,
    }),
    [isLive, statusLine, setPropFirmTabSafe, setMultiAgentActive, registerPropFirmSlot, registerMultiAgentSlot],
  );

  const engine =
    route.kind !== "none" && portalTarget ? (
      <MultiAgentDeskSessionEngine route={route} onRuntimeChange={handleRuntimeChange} />
    ) : null;

  return (
    <MultiAgentDeskSessionContext.Provider value={ctxValue}>
      {children}
      <div
        ref={(el) => {
          fallbackHostRef.current = el;
          setFallbackReady(!!el);
        }}
        className="pointer-events-none fixed -left-[10000px] top-0 h-[720px] w-[1200px] overflow-hidden opacity-0"
        aria-hidden
      />
      {fallbackReady && engine && portalTarget ? createPortal(engine, portalTarget) : null}
    </MultiAgentDeskSessionContext.Provider>
  );
}
