import { DEFAULT_LATENCY_CHECK_INTERVAL_MS, CONFIG_VERSION } from '@/constants';
import type { DnsServer } from './dns';

export const ThemeMode = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
} as const;
export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode];

export const ScheduleConditionType = {
  TIME: 'time',
  NETWORK: 'network',
  CRON: 'cron',
  STARTUP: 'startup',
  ALWAYS: 'always',
} as const;
export type ScheduleConditionType = (typeof ScheduleConditionType)[keyof typeof ScheduleConditionType];

export interface AppConfig {
  version: number;
  servers: DnsServer[];
  schedule: ScheduleConfig;
  settings: AppSettings;
  theme: ThemeConfig;
}

export interface ScheduleConfig {
  enabled: boolean;
  rules: ScheduleRule[];
}

export interface ScheduleRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: ScheduleCondition;
  action: ScheduleAction;
  priority: number;
  description?: string;
}

export type ScheduleCondition =
  | {
      type: typeof ScheduleConditionType.TIME;
      timeRange: TimeRange;
      daysOfWeek: number[];
    }
  | {
      type: typeof ScheduleConditionType.NETWORK;
      ssid?: string;
      interfaceName?: string;
    }
  | { type: typeof ScheduleConditionType.CRON; expression: string }
  | { type: typeof ScheduleConditionType.STARTUP }
  | { type: typeof ScheduleConditionType.ALWAYS };

export interface TimeRange {
  start: string;
  end: string;
}

export interface ScheduleAction {
  targetServerId: string;
}

export interface AppSettings {
  autoStart: boolean;
  minimizeToTray: boolean;
  checkUpdates: boolean;
  notifyOnSwitch: boolean;
  latencyCheckInterval: number;
}

export interface ThemeConfig {
  mode: ThemeMode;
}

export const DEFAULT_CONFIG: AppConfig = {
  version: CONFIG_VERSION,
  servers: [],
  schedule: {
    enabled: false,
    rules: [],
  },
  settings: {
    autoStart: false,
    minimizeToTray: true,
    checkUpdates: true,
    notifyOnSwitch: true,
    latencyCheckInterval: DEFAULT_LATENCY_CHECK_INTERVAL_MS,
  },
  theme: {
    mode: ThemeMode.SYSTEM,
  },
};
