export const DnsProviderKey = {
  SYSTEM: 'system',
  CLOUDFLARE: 'cloudflare',
  GOOGLE: 'google',
  QUAD9: 'quad9',
  OPENDNS: 'opendns',
  CUSTOM: 'custom',
} as const
export type DnsProviderKey = (typeof DnsProviderKey)[keyof typeof DnsProviderKey]

export const DnsServerTag = {
  PUBLIC: 'public',
  PRIVACY: 'privacy',
  FAST: 'fast',
  SECURITY: 'security',
  FAMILY: 'family',
} as const
export type DnsServerTag = (typeof DnsServerTag)[keyof typeof DnsServerTag]

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
  [DnsProviderKey.CUSTOM]: {
    name: DnsProviderKey.CUSTOM,
    displayName: 'Custom',
    description: 'Custom DNS server',
  },
} as const

export interface DnsServer {
  id: string
  name: string
  addresses: string[]
  provider: DnsProvider
  latency?: number
  isActive: boolean
  isSystem: boolean
  tags: DnsServerTag[]
  createdAt: number
  updatedAt: number
}

export interface DnsProvider {
  name: string
  displayName: string
  website?: string
  description?: string
}

export interface DnsStatus {
  currentServers: string[]
  networkService: string
  isCustom: boolean
  latency?: number
}

export interface DnsQueryResult {
  domain: string
  recordType: string
  answers: string[]
  server: string
  latency: number
  timestamp: number
}

export interface DnsLatencyTest {
  serverId: string
  address: string
  latencyMs: number
  success: boolean
  error?: string
}

export const PRESET_SERVERS: DnsServer[] = [
  {
    id: DnsProviderKey.CLOUDFLARE,
    name: 'Cloudflare',
    addresses: ['1.1.1.1', '1.0.0.1'],
    provider: DnsProviderInfo[DnsProviderKey.CLOUDFLARE],
    isActive: false,
    isSystem: false,
    tags: [DnsServerTag.PUBLIC, DnsServerTag.PRIVACY],
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
]
