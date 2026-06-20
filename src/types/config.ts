// ============================================================
// 应用配置、调度规则、用户设置等类型定义
// ============================================================

import { DEFAULT_LATENCY_CHECK_INTERVAL_MS, CONFIG_VERSION } from '@/constants';
import type { DnsServer } from './dns';

/** 主题模式 */
export const ThemeMode = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
} as const;
export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode];

/** 调度条件类型：time=时间段 / network=网络 / cron=Cron 表达式 / startup=启动时 / always=始终 */
export const ScheduleConditionType = {
  TIME: 'time',
  NETWORK: 'network',
  CRON: 'cron',
  STARTUP: 'startup',
  ALWAYS: 'always',
} as const;
export type ScheduleConditionType = (typeof ScheduleConditionType)[keyof typeof ScheduleConditionType];

/** 应用根配置 */
export interface AppConfig {
  version: number;
  servers: DnsServer[];
  schedule: ScheduleConfig;
  settings: AppSettings;
  theme: ThemeConfig;
}

/** 调度模块配置 */
export interface ScheduleConfig {
  /** 是否启用调度功能 */
  enabled: boolean;
  /** 调度规则列表 */
  rules: ScheduleRule[];
}

/** 单条调度规则 */
export interface ScheduleRule {
  id: string;
  name: string;
  enabled: boolean;
  /** 触发条件 */
  condition: ScheduleCondition;
  /** 触发后执行的操作 */
  action: ScheduleAction;
  /** 优先级，数字越小优先级越高 */
  priority: number;
  description?: string;
}

/** 调度触发条件（联合类型） */
export type ScheduleCondition =
  | {
      type: typeof ScheduleConditionType.TIME;
      /** 时间段范围 */
      timeRange: TimeRange;
      /** 生效的星期几（0=周日, 1=周一, ..., 6=周六） */
      daysOfWeek: number[];
    }
  | {
      type: typeof ScheduleConditionType.NETWORK;
      /** Wi-Fi SSID */
      ssid?: string;
      /** 网络接口名称 */
      interfaceName?: string;
    }
  | { type: typeof ScheduleConditionType.CRON; expression: string }
  | { type: typeof ScheduleConditionType.STARTUP }
  | { type: typeof ScheduleConditionType.ALWAYS };

/** 时间段（HH:mm 格式） */
export interface TimeRange {
  start: string;
  end: string;
}

/** 调度动作：切换到指定 DNS 服务器 */
export interface ScheduleAction {
  targetServerId: string;
}

/** 用户设置 */
export interface AppSettings {
  /** 开机自启 */
  autoStart: boolean;
  /** 最小化到系统托盘 */
  minimizeToTray: boolean;
  /** 自动检查更新 */
  checkUpdates: boolean;
  /** DNS 切换时显示通知 */
  notifyOnSwitch: boolean;
  /** 延迟检查间隔（毫秒） */
  latencyCheckInterval: number;
}

/** 主题配置 */
export interface ThemeConfig {
  mode: ThemeMode;
}

/** 默认应用配置 */
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
