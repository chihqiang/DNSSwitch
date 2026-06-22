// ============================================================
// 全局常量定义
// ============================================================

/** 配置文件版本号 */
export const CONFIG_VERSION = 1;

/** 延迟阈值：高于此值为高延迟（显示 danger 标签） */
export const LATENCY_HIGH_MS = 200;
/** 延迟阈值：高于此值为中等延迟（显示 warning 标签） */
export const LATENCY_MEDIUM_MS = 80;
/** 延迟测试历史最大保留条数 */
export const MAX_LATENCY_HISTORY = 100;
/** 默认延迟检查间隔（毫秒），默认 60 秒 */
export const DEFAULT_LATENCY_CHECK_INTERVAL_MS = 60000;
/** 延迟检查间隔最小值（秒） */
export const LATENCY_CHECK_INTERVAL_MIN_S = 10;
/** 延迟检查间隔最大值（秒） */
export const LATENCY_CHECK_INTERVAL_MAX_S = 600;

/** 键盘按键常量 */
export const KEY_ESCAPE = 'Escape';
export const KEY_TAB = 'Tab';

/** 根据延迟值返回对应的 Badge 样式变体 */
export function getLatencyBadgeVariant(latency: number | undefined): 'success' | 'warning' | 'danger' {
  if (latency === undefined) return 'success';
  if (latency > LATENCY_HIGH_MS) return 'danger';
  if (latency > LATENCY_MEDIUM_MS) return 'warning';
  return 'success';
}
