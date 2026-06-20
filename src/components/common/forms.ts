// ============================================================
// 表单输入框公共样式
// 供 AddServerForm / AddRuleForm 等表单组件复用
// ============================================================

export const INPUT_CLASS =
  'px-3 py-2 border rounded bg-bg-card text-text-primary text-sm outline-none transition-all duration-150';
/** 错误状态边框色 */
export const INPUT_CLASS_ERROR = 'border-danger';
/** 默认状态边框色 */
export const INPUT_CLASS_DEFAULT = 'border-border';
/** 聚焦态样式 */
export const INPUT_FOCUS = 'focus:border-accent focus:shadow-[0_0_0_1px_var(--accent)]';
/** 标签样式 */
export const LABEL_CLASS = 'text-xs font-medium text-text-secondary';
/** 错误提示文字样式 */
export const ERROR_CLASS = 'text-xs text-danger';

/** 根据是否传入 error 返回带错误/正常样式的完整 className */
export function inputClass(error?: string): string {
  return `${INPUT_CLASS} ${INPUT_FOCUS} ${error ? INPUT_CLASS_ERROR : INPUT_CLASS_DEFAULT}`;
}
