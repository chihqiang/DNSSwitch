import { create } from 'zustand';
import type { ScheduleEventPayload } from '@/types';

interface ScheduleState {
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (payload: ScheduleEventPayload) => void;
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
