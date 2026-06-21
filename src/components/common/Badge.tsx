// ============================================================
// Badge 标签组件
// 用于展示状态标签，如"活跃"、"延迟"、标签分类等
// ============================================================

import type { ReactNode } from 'react';
import { BadgeVariant } from './variants';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

/** 各变体对应的 Tailwind CSS 类名 */
const variantClasses: Record<BadgeVariant, string> = {
  [BadgeVariant.DEFAULT]: 'bg-bg-card text-text-muted',
  [BadgeVariant.SUCCESS]: 'bg-success-bg text-success',
  [BadgeVariant.WARNING]: 'bg-warning-bg text-warning',
  [BadgeVariant.DANGER]: 'bg-danger-bg text-danger',
  [BadgeVariant.INFO]: 'bg-info-bg text-info',
};

export function Badge({ children, variant = BadgeVariant.DEFAULT }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}`}
    >
      {children}
    </span>
  );
}
