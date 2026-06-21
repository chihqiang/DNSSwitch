// ============================================================
// Toast 通知弹出层 — 右下角堆叠，自动消失
// ============================================================

import { useToastStore, type ToastType } from '@/stores/toastStore';

const BAR: Record<ToastType, string> = {
  success: '#22c55e',
  error: '#ef4444',
  info: '#3b82f6',
};

const ICON: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80" role="alert" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className="flex items-stretch bg-bg-card rounded-lg shadow-lg border border-border overflow-hidden cursor-pointer animate-slide-in"
        >
          {/* 左侧色条 */}
          <div className="w-1 shrink-0" style={{ backgroundColor: BAR[toast.type] }} />
          {/* 内容区 */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 flex-1 min-w-0">
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: BAR[toast.type] }}
            >
              {ICON[toast.type]}
            </span>
            <p className="text-sm text-text-primary truncate flex-1">{toast.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
