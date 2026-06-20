// ============================================================
// DNS 服务器、DNS 查询结果、延迟测试等核心数据类型定义
// ============================================================

/** DNS 提供商标识常量 */
export const DnsProviderKey = {
  SYSTEM: 'system',
  CLOUDFLARE: 'cloudflare',
  CLOUDFLARE_FAMILY: 'cloudflare_family',
  GOOGLE: 'google',
  QUAD9: 'quad9',
  OPENDNS: 'opendns',
  ADGUARD: 'adguard',
  NEXTDNS: 'nextdns',
  COMODOSECURE: 'comodosecure',
  DNSWATCH: 'dnswatch',
  CLEANBROWSING: 'cleanbrowsing',
  ALIDNS: 'alidns',
  DNSPOD: 'dnspod',
  CUSTOM: 'custom',
} as const;
export type DnsProviderKey = (typeof DnsProviderKey)[keyof typeof DnsProviderKey];

/** DNS 服务器标签：public=公共 / privacy=隐私 / fast=快速 / security=安全 / family=家庭 */
export const DnsServerTag = {
  PUBLIC: 'public',
  PRIVACY: 'privacy',
  FAST: 'fast',
  SECURITY: 'security',
  FAMILY: 'family',
} as const;
export type DnsServerTag = (typeof DnsServerTag)[keyof typeof DnsServerTag];

/** 各 DNS 提供商的基本信息（名称、官网、描述） */
export const DnsProviderInfo = {
  [DnsProviderKey.SYSTEM]: {
    name: DnsProviderKey.SYSTEM,
    displayName: 'System Default',
    description: 'Use system default DNS',
  },
  [DnsProviderKey.CLOUDFLARE]: {
    name: DnsProviderKey.CLOUDFLARE,
    displayName: 'Cloudflare',
    website: 'https://1.1.1.1',
    description: '1.1.1.1 - Privacy-first DNS',
  },
  [DnsProviderKey.CLOUDFLARE_FAMILY]: {
    name: DnsProviderKey.CLOUDFLARE_FAMILY,
    displayName: 'Cloudflare Family',
    website: 'https://1.1.1.1/family',
    description: '1.1.1.2 - Malware blocking',
  },
  [DnsProviderKey.GOOGLE]: {
    name: DnsProviderKey.GOOGLE,
    displayName: 'Google DNS',
    website: 'https://dns.google',
    description: '8.8.8.8 - Reliable public DNS',
  },
  [DnsProviderKey.QUAD9]: {
    name: DnsProviderKey.QUAD9,
    displayName: 'Quad9',
    website: 'https://quad9.net',
    description: '9.9.9.9 - Security-focused DNS',
  },
  [DnsProviderKey.OPENDNS]: {
    name: DnsProviderKey.OPENDNS,
    displayName: 'OpenDNS',
    website: 'https://opendns.com',
    description: '208.67.222.222 - Family-friendly DNS',
  },
  [DnsProviderKey.ADGUARD]: {
    name: DnsProviderKey.ADGUARD,
    displayName: 'AdGuard DNS',
    website: 'https://adguard.com/adguard-dns/overview.html',
    description: '94.140.14.14 - Ad-blocking DNS',
  },
  [DnsProviderKey.NEXTDNS]: {
    name: DnsProviderKey.NEXTDNS,
    displayName: 'NextDNS',
    website: 'https://nextdns.io',
    description: '45.90.28.28 - Privacy-focused DNS',
  },
  [DnsProviderKey.COMODOSECURE]: {
    name: DnsProviderKey.COMODOSECURE,
    displayName: 'Comodo Secure',
    website: 'https://www.comodo.com/secure-dns',
    description: '8.26.56.26 - Security-focused DNS',
  },
  [DnsProviderKey.DNSWATCH]: {
    name: DnsProviderKey.DNSWATCH,
    displayName: 'DNS.WATCH',
    website: 'https://dns.watch',
    description: '84.200.69.80 - Privacy-focused DNS',
  },
  [DnsProviderKey.CLEANBROWSING]: {
    name: DnsProviderKey.CLEANBROWSING,
    displayName: 'CleanBrowsing',
    website: 'https://cleanbrowsing.org',
    description: '185.228.168.168 - Family-safe DNS',
  },
  [DnsProviderKey.ALIDNS]: {
    name: DnsProviderKey.ALIDNS,
    displayName: 'AliDNS',
    website: 'https://www.alidns.com',
    description: '223.5.5.5 - Fast DNS in Asia',
  },
  [DnsProviderKey.DNSPOD]: {
    name: DnsProviderKey.DNSPOD,
    displayName: 'DNSPod',
    website: 'https://www.dnspod.cn',
    description: '119.29.29.29 - Fast DNS in China',
  },
  [DnsProviderKey.CUSTOM]: {
    name: DnsProviderKey.CUSTOM,
    displayName: 'Custom',
    description: 'Custom DNS server',
  },
} as const;

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

/** DNS 提供商描述信息 */
export interface DnsProvider {
  name: string;
  displayName: string;
  website?: string;
  description?: string;
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

// ============================================================
// 预设 DNS 服务器列表
// ============================================================

export const PRESET_SERVERS: DnsServer[] = [
  {
    id: DnsProviderKey.CLOUDFLARE,
    name: 'Cloudflare',
    addresses: ['1.1.1.1', '1.0.0.1'],
    provider: DnsProviderInfo[DnsProviderKey.CLOUDFLARE],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.PUBLIC, DnsServerTag.PRIVACY],
    dohUrl: 'https://dns.cloudflare.com/dns-query',
    dotAddress: '1.1.1.1',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.CLOUDFLARE_FAMILY,
    name: 'Cloudflare Family',
    addresses: ['1.1.1.2', '1.0.0.2'],
    provider: DnsProviderInfo[DnsProviderKey.CLOUDFLARE_FAMILY],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.FAMILY, DnsServerTag.SECURITY],
    dohUrl: 'https://dns.cloudflare.com/dns-query',
    dotAddress: '1.1.1.2',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.GOOGLE,
    name: 'Google DNS',
    addresses: ['8.8.8.8', '8.8.4.4'],
    provider: DnsProviderInfo[DnsProviderKey.GOOGLE],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.PUBLIC, DnsServerTag.FAST],
    dohUrl: 'https://dns.google/dns-query',
    dotAddress: '8.8.8.8',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.QUAD9,
    name: 'Quad9',
    addresses: ['9.9.9.9', '149.112.112.112'],
    provider: DnsProviderInfo[DnsProviderKey.QUAD9],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.PUBLIC, DnsServerTag.SECURITY],
    dohUrl: 'https://dns.quad9.net/dns-query',
    dotAddress: '9.9.9.9',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.OPENDNS,
    name: 'OpenDNS',
    addresses: ['208.67.222.222', '208.67.220.220'],
    provider: DnsProviderInfo[DnsProviderKey.OPENDNS],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.PUBLIC, DnsServerTag.FAMILY],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.ADGUARD,
    name: 'AdGuard DNS',
    addresses: ['94.140.14.14', '94.140.15.15'],
    provider: DnsProviderInfo[DnsProviderKey.ADGUARD],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.PUBLIC, DnsServerTag.PRIVACY],
    dohUrl: 'https://dns.adguard.com/dns-query',
    dotAddress: '94.140.14.14',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.NEXTDNS,
    name: 'NextDNS',
    addresses: ['45.90.28.28', '45.90.30.28'],
    provider: DnsProviderInfo[DnsProviderKey.NEXTDNS],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.PRIVACY, DnsServerTag.SECURITY],
    dohUrl: 'https://dns.nextdns.io/dns-query',
    dotAddress: '45.90.28.28',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.COMODOSECURE,
    name: 'Comodo Secure',
    addresses: ['8.26.56.26', '8.20.247.20'],
    provider: DnsProviderInfo[DnsProviderKey.COMODOSECURE],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.SECURITY],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.DNSWATCH,
    name: 'DNS.WATCH',
    addresses: ['84.200.69.80', '84.200.70.40'],
    provider: DnsProviderInfo[DnsProviderKey.DNSWATCH],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.PRIVACY],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.CLEANBROWSING,
    name: 'CleanBrowsing',
    addresses: ['185.228.168.168', '185.228.169.168'],
    provider: DnsProviderInfo[DnsProviderKey.CLEANBROWSING],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.FAMILY, DnsServerTag.SECURITY],
    dohUrl: 'https://dns.cleanbrowsing.org/dns-query',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.ALIDNS,
    name: 'AliDNS',
    addresses: ['223.5.5.5', '223.6.6.6'],
    provider: DnsProviderInfo[DnsProviderKey.ALIDNS],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.FAST, DnsServerTag.PUBLIC],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: DnsProviderKey.DNSPOD,
    name: 'DNSPod',
    addresses: ['119.29.29.29', '119.28.28.28'],
    provider: DnsProviderInfo[DnsProviderKey.DNSPOD],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.FAST, DnsServerTag.PUBLIC],
    createdAt: 0,
    updatedAt: 0,
  },
];
