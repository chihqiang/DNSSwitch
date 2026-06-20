// ============================================================
// DNS 请求日志条目类型
// ============================================================

/** 单条请求日志 */
export interface RequestLogEntry {
  id: string;
  /** 时间戳（毫秒） */
  timestamp: number;
  /** 日志类型：dns_query=DNS查询 / switch=切换 / other=其他 */
  type: 'dns_query' | 'switch' | 'other';
  /** 查询的域名 */
  domain: string;
  /** 使用的 DNS 服务器 */
  server: string;
  /** 协议：udp / doh / dot */
  protocol: string;
  /** DNS 记录类型（A, AAAA, MX 等） */
  recordType: string;
  /** 延迟（毫秒） */
  latencyMs: number;
  /** 是否成功 */
  success: boolean;
  /** 解析结果 */
  answers: string[];
  /** 错误详情 */
  detail?: string;
}
