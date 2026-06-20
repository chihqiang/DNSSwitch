export const CONFIG_VERSION = 1

export const LATENCY_HIGH_MS = 200
export const LATENCY_MEDIUM_MS = 80
export const MAX_LATENCY_HISTORY = 100
export const DEFAULT_LATENCY_CHECK_INTERVAL_MS = 60000
export const LATENCY_CHECK_INTERVAL_MIN_S = 10
export const LATENCY_CHECK_INTERVAL_MAX_S = 600

export const DNS_TIMEOUT_SECS = 5
export const DNS_PORT = 53
export const DNS_BUFFER_SIZE = 512
export const DNS_TEST_DOMAIN = 'one.one.one.one'
export const DNS_BIND_ADDRESS = '0.0.0.0:0'
export const KEY_ESCAPE = 'Escape'
export const KEY_ENTER = 'Enter'
export const KEY_SPACE = ' '

export function getLatencyBadgeVariant(latency: number | undefined): 'success' | 'warning' | 'danger' {
  if (latency === undefined) return 'success'
  if (latency > LATENCY_HIGH_MS) return 'danger'
  if (latency > LATENCY_MEDIUM_MS) return 'warning'
  return 'success'
}
