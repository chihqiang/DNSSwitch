// ============================================================
// DNS 请求日志 Store（Zustand）
// 记录 DNS 查询历史，最多保留 200 条
// ============================================================

import { create } from 'zustand';
import type { RequestLogEntry } from '@/types';

/** 日志最大保留条数 */
const MAX_LOG = 200;

interface RequestLogState {
  /** 日志条目列表（最新的在前） */
  entries: RequestLogEntry[];
  /** 添加一条日志 */
  addEntry: (entry: RequestLogEntry) => void;
  /** 清空全部日志 */
  clearEntries: () => void;
}

export const useRequestLogStore = create<RequestLogState>((set) => ({
  entries: [],
  addEntry: (entry) =>
    set((s) => ({
      entries: [entry, ...s.entries].slice(0, MAX_LOG),
    })),
  clearEntries: () => set({ entries: [] }),
}));
