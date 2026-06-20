// ============================================================
// 调度事件载荷类型（由 Rust 后端推送）
// ============================================================

/** 调度事件，由 Rust 后端的调度引擎触发并通过 Tauri event 推送 */
export interface ScheduleEventPayload {
  /** 事件动作：switched=已切换 / error=出错 */
  action: string;
  /** 触发该事件的规则名称 */
  ruleName: string;
  /** 目标 DNS 服务器 */
  targetServer: string;
  /** 错误信息（仅 action=error 时有值） */
  error?: string;
  /** 事件发生时间戳 */
  timestamp: number;
}
