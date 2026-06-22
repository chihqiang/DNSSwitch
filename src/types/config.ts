// ============================================================
// 应用配置、服务器、用户设置等类型定义
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

/** 应用根配置 */
export interface AppConfig {
  version: number;
  servers: DnsServer[];
  /** 当前激活的 DNS 服务器 ID（undefined 表示使用系统默认） */
  activeServerId?: string;
  /** Chrome DoH 当前激活的服务器 ID */
  activeChromeServerId?: string;
  settings: AppSettings;
  theme: ThemeConfig;
}

/** 用户设置 */
export interface AppSettings {
  /** 开机自启 */
  autoStart: boolean;
  /** 最小化到系统托盘 */
  minimizeToTray: boolean;
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
  settings: {
    autoStart: false,
    minimizeToTray: true,
    notifyOnSwitch: true,
    latencyCheckInterval: DEFAULT_LATENCY_CHECK_INTERVAL_MS,
  },
  theme: {
    mode: ThemeMode.SYSTEM,
  },
};
