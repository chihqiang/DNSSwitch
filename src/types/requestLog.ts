export interface RequestLogEntry {
  id: string
  timestamp: number
  type: 'dns_query' | 'switch' | 'other'
  domain: string
  server: string
  protocol: string
  recordType: string
  latencyMs: number
  success: boolean
  answers: string[]
  detail?: string
}
