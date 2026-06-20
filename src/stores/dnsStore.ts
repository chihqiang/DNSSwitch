// ============================================================
// DNS 状态管理 Store（Zustand）
// 管理 DNS 服务器列表、当前状态、延迟测试结果、泄露检测等
// ============================================================

import { create } from 'zustand';
import type { DnsServer, DnsStatus, DnsLatencyTest, DnsLeakResult, DnsHealthEvent } from '@/types';
import { MAX_LATENCY_HISTORY } from '@/constants';

interface DnsState {
  /** 当前系统 DNS 状态 */
  currentStatus: DnsStatus | null;
  /** DNS 服务器列表 */
  servers: DnsServer[];
  /** 延迟测试历史记录 */
  latencyTests: DnsLatencyTest[];
  /** 最近一次 DNS 泄露检测结果 */
  lastLeakResult: DnsLeakResult | null;
  /** 最近一次健康检查结果 */
  healthStatus: DnsHealthEvent | null;
  /** 是否有服务器正在测试延迟 */
  isTesting: boolean;
  /** 是否有服务器正在切换 */
  isSwitching: boolean;
  /** 当前正在切换的服务器 ID，用于 per-server 加载状态 */
  switchingServerId: string | null;
  /** 当前正在测试延迟的服务器 ID，用于 per-server 加载状态 */
  testingServerId: string | null;
  /** 错误信息 */
  error: string | null;

  setCurrentStatus: (status: DnsStatus) => void;
  setServers: (servers: DnsServer[]) => void;
  addServer: (server: DnsServer) => void;
  removeServer: (id: string) => void;
  updateServer: (id: string, updates: Partial<DnsServer>) => void;
  setActiveServer: (id: string) => void;
  clearActive: () => void;
  setLatencyTests: (tests: DnsLatencyTest[]) => void;
  addLatencyTest: (test: DnsLatencyTest) => void;
  setLastLeakResult: (result: DnsLeakResult | null) => void;
  setHealthStatus: (status: DnsHealthEvent | null) => void;
  setIsTesting: (v: boolean) => void;
  setIsSwitching: (v: boolean) => void;
  setSwitchingServerId: (id: string | null) => void;
  setTestingServerId: (id: string | null) => void;
  setError: (error: string | null) => void;
}

export const useDnsStore = create<DnsState>((set) => ({
  currentStatus: null,
  servers: [],
  latencyTests: [],
  lastLeakResult: null,
  healthStatus: null,
  isTesting: false,
  isSwitching: false,
  switchingServerId: null,
  testingServerId: null,
  error: null,

  setCurrentStatus: (status) => set({ currentStatus: status }),

  setServers: (servers) => set({ servers }),

  addServer: (server) => set((state) => ({ servers: [...state.servers, server] })),

  removeServer: (id) => set((state) => ({ servers: state.servers.filter((s) => s.id !== id) })),

  updateServer: (id, updates) =>
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s)),
    })),

  /** 设置活跃服务器，同时将其他所有服务器标记为非活跃 */
  setActiveServer: (id) =>
    set((state) => ({
      servers: state.servers.map((s) => ({
        ...s,
        isActive: s.id === id,
        updatedAt: s.id === id ? Date.now() : s.updatedAt,
      })),
    })),

  /** 清除所有服务器的活跃状态（恢复为系统 DNS 时使用） */
  clearActive: () =>
    set((state) => ({
      servers: state.servers.map((s) => ({
        ...s,
        isActive: false,
      })),
    })),

  setLatencyTests: (tests) => set({ latencyTests: tests }),

  /** 添加延迟测试记录，超出 MAX_LATENCY_HISTORY 时自动裁剪 */
  addLatencyTest: (test) =>
    set((state) => ({
      latencyTests: [test, ...state.latencyTests].slice(0, MAX_LATENCY_HISTORY),
    })),

  setLastLeakResult: (result) => set({ lastLeakResult: result }),

  setHealthStatus: (status) => set({ healthStatus: status }),

  setIsTesting: (v) => set({ isTesting: v }),
  setIsSwitching: (v) => set({ isSwitching: v }),
  setSwitchingServerId: (id) => set({ switchingServerId: id }),
  setTestingServerId: (id) => set({ testingServerId: id }),
  setError: (error) => set({ error }),
}));
