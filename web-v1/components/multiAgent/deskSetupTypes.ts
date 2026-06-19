import type { MultiAgentStoredConfig } from "@/lib/multiAgent";

export type DeskTradeSetupProps = {
  config: MultiAgentStoredConfig;
  updateField: <K extends keyof MultiAgentStoredConfig>(
    key: K,
    value: MultiAgentStoredConfig[K],
  ) => void;
  monitorIntervalSeconds: number;
  setMonitorIntervalSeconds: (seconds: number) => void;
  validation: string[];
  connected: boolean;
  autoTrading: boolean;
  streaming: boolean;
  monitoring: boolean;
  statusLine: string;
  onStartAuto: () => void;
  onStopAuto: () => void;
};
