// ============================================================
// Card 卡片容器组件
// 统一的面板样式，可选点击交互
// ============================================================

import type { ReactNode, KeyboardEvent } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** 如传入 onClick，Card 将具备按钮交互（role=button, 键盘支持） */
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  const isClickable = !!onClick;

  return (
    <div
      className={`bg-bg-card border border-border rounded shadow-card ${className}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') onClick?.();
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
