// DNS 服务器、DNS 查询结果、延迟测试等核心数据类型定义

/** DNS 服务器标签：public=公共 / privacy=隐私 / fast=快速 / security=安全 / family=家庭 */
export const DnsServerTag = {
  PUBLIC: 'public',
  PRIVACY: 'privacy',
  FAST: 'fast',
  SECURITY: 'security',
  FAMILY: 'family',
} as const;
export type DnsServerTag = (typeof DnsServerTag)[keyof typeof DnsServerTag];

// ---- 来自 Rust dnsprovider.json 的数据结构 ----

/** 提供商元数据（来自 Rust ProviderInfo） */
export interface ProviderInfo {
  key: string;
  name: string;
  displayName: string;
  website?: string;
  description?: string;
}

/** 预设/自定义服务器定义（来自 Rust ServerDef） */
export interface ServerDef {
  id: string;
  name: string;
  providerKey: string;
  addresses: string[];
  tags: string[];
  dohUrl?: string;
  dotAddress?: string;
}

/** 提供商注册表（来自 Rust ProviderRegistry） */
export interface ProviderRegistry {
  providers: ProviderInfo[];
  servers: ServerDef[];
}

// ---- 运行时 DNS 服务器实例 ----

/** DNS 提供商描述信息 */
export interface DnsProvider {
  name: string;
  displayName: string;
  website?: string;
  description?: string;
}

/** DNS 服务器实例 */
export interface DnsServer {
  id: string;
  name: string;
  /** DNS 服务器 IP 地址列表 */
  addresses: string[];
  provider: DnsProvider;
  /** 延迟（毫秒），undefined 表示尚未测试 */
  latency?: number;
  /** 是否为当前激活的服务器 */
  isActive: boolean;
  /** 是否为系统默认 DNS（不可删除） */
  isSystem: boolean;
  tags: DnsServerTag[];
  /** DNS-over-HTTPS 端点 URL */
  dohUrl?: string;
  /** DNS-over-TLS 服务器地址 */
  dotAddress?: string;
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
}

/** 当前系统 DNS 状态 */
export interface DnsStatus {
  /** 当前使用的 DNS 服务器地址列表 */
  currentServers: string[];
  /** 网络服务名称 */
  networkService: string;
  /** 是否为自定义 DNS */
  isCustom: boolean;
  latency?: number;
  /** Chrome DoH 端点 URL（当 DNS 通过 Chrome 策略切换时） */
  chromeDohUrl?: string;
  /** 是否安装了 Chrome 浏览器 */
  chromeInstalled: boolean;
}

/** DNS 切换/操作事件（用于历史记录） */
export interface DnsEvent {
  id: string;
  eventType: string;
  serverName: string;
  addresses: string[];
  latencyMs?: number;
  success: boolean;
  detail?: string;
  timestamp: number;
}

/** DNS 查询结果 */
export interface DnsQueryResult {
  domain: string;
  recordType: string;
  answers: string[];
  server: string;
  latencyMs: number;
  timestamp: number;
}

/** DNS 泄露检测结果 */
export interface DnsLeakResult {
  expectedServers: string[];
  actualServers: string[];
  /** 是否检测到 DNS 泄露 */
  leakDetected: boolean;
  /** DNS 服务器是否可达 */
  isReachable: boolean;
  latencyMs?: number;
  detail: string;
}

/** DNS 延迟测试结果 */
export interface DnsLatencyTest {
  serverId: string;
  address: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}
