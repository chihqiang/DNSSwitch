export interface ScheduleEventPayload {
  action: string
  ruleName: string
  targetServer: string
  error?: string
  timestamp: number
}
