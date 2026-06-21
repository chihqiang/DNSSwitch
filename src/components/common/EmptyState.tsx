// ============================================================
// EmptyState 空状态占位组件
// 用于列表/面板无数据时的友好提示
// ============================================================

import type { ReactNode } from 'react';

interface Props {
  icon?: string;
  title: string;
  description?: string;
  /** 可选的操作按钮 */
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon !== undefined ? (
        <span className="text-2xl text-text-muted">{icon}</span>
      ) : (
        <svg
          className="w-10 h-10 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
      )}
      <p className="text-sm text-text-muted font-medium">{title}</p>
      {description && <p className="text-xs text-text-muted/70 max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
