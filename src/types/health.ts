// ============================================================
// DNS 健康检查事件类型
// ============================================================

/** DNS 健康检查结果，由 Rust 后端定期推送 */
export interface DnsHealthEvent {
  /** 当前 DNS 是否健康 */
  healthy: boolean;
  latencyMs: number;
  serverName: string;
  serverAddress: string;
  /** DNS 是否成功解析 */
  resolved: boolean;
  /** 是否检测到 DNS 泄露 */
  leakDetected: boolean;
  /** 错误信息，正常时为 null */
  error: string | null;
  timestamp: number;
}
