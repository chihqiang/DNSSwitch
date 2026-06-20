export interface DnsHealthEvent {
  healthy: boolean
  latencyMs: number
  serverName: string
  serverAddress: string
  resolved: boolean
  leakDetected: boolean
  error: string | null
  timestamp: number
}
