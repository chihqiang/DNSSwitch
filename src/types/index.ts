// ============================================================
// 类型定义统一导出入口
// ============================================================

export type { DnsServer, DnsProvider, DnsStatus, DnsQueryResult, DnsLatencyTest, DnsLeakResult, DnsEvent, ProviderInfo, ServerDef, ProviderRegistry } from './dns';
export { DnsServerTag } from './dns';

export type {
  AppConfig,
  AppSettings,
  ThemeConfig,
} from './config';
export { ThemeMode, DEFAULT_CONFIG } from './config';

export type { NetworkInterface, NetworkService, SystemInfo, AppInfo } from './system';

export type { RequestLogEntry } from './requestLog';

export type { DnsHealthEvent, DnsLatencyUpdate, ServerLatency } from './health';

export { NetworkInterfaceType } from './system';
