// ============================================================
// 调度事件通知 Store（Zustand）
// 接收 Rust 后端推送的调度事件，管理 Toast 通知状态
// ============================================================

import { create } from 'zustand';
import type { ScheduleEventPayload } from '@/types';

interface ScheduleState {
  /** 当前显示的 Toast 通知 */
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  /** 处理调度事件，生成对应的 Toast 消息 */
  showToast: (payload: ScheduleEventPayload) => void;
  /** 清除 Toast 通知 */
  clearToast: () => void;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  toast: null,
  showToast: (payload) => {
    const msg =
      payload.action === 'switched'
        ? `Schedule: switched to ${payload.targetServer} (rule: "${payload.ruleName}")`
        : `Schedule error: ${payload.error || 'unknown'}`;
    set({
      toast: {
        message: msg,
        type: payload.action === 'switched' ? 'success' : 'error',
      },
    });
  },
  clearToast: () => set({ toast: null }),
}));
