// ============================================================
// Badge / Button 共用样式变体常量
// 从组件文件中抽离，避免 react-refresh 警告
// ============================================================

/** Badge 样式变体 */
export const BadgeVariant = {
  DEFAULT: 'default',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'danger',
  INFO: 'info',
} as const;
export type BadgeVariant = (typeof BadgeVariant)[keyof typeof BadgeVariant];

/** Button 样式变体 */
export const ButtonVariant = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  DANGER: 'danger',
  GHOST: 'ghost',
} as const;
export type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant];

/** Button 尺寸 */
export const ButtonSize = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
} as const;
export type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize];
