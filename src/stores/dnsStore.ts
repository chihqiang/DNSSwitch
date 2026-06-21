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
  batchUpdateFromMonitor: (results: { serverId: string; latencyMs: number; success: boolean }[]) => void;
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

  /** 更新服务器属性，值无变化时跳过更新以保持引用稳定 */
  updateServer: (id, updates) =>
    set((state) => {
      const idx = state.servers.findIndex((s) => s.id === id);
      if (idx === -1) return {};
      const existing = state.servers[idx];
      const keys = Object.keys(updates);
      // 仅当只传了 latency 且未变化时才跳过（防止同一批次中丢弃其他字段）
      if (keys.length === 1 && 'latency' in updates && existing.latency === updates.latency) return {};
      const servers = [...state.servers];
      servers[idx] = { ...existing, ...updates, updatedAt: Date.now() };
      return { servers };
    }),

  /** 设置活跃服务器，仅更新变更的项以保持引用稳定 */
  setActiveServer: (id) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === id ? { ...s, isActive: true, updatedAt: Date.now() } : s.isActive ? { ...s, isActive: false } : s,
      ),
    })),

  /** 清除所有服务器的活跃状态 */
  clearActive: () =>
    set((state) => ({
      servers: state.servers.map((s) => (s.isActive ? { ...s, isActive: false } : s)),
    })),

  setLatencyTests: (tests) => set({ latencyTests: tests }),

  /** 添加延迟测试记录，超出 MAX_LATENCY_HISTORY 时自动裁剪 */
  addLatencyTest: (test) =>
    set((state) => ({
      latencyTests: [test, ...state.latencyTests].slice(0, MAX_LATENCY_HISTORY),
    })),

  setLastLeakResult: (result) => set({ lastLeakResult: result }),

  /** 批量更新延迟测试结果（来自 monitor 推送），单次 set() 避免循环触发 listener */
  batchUpdateFromMonitor: (results: { serverId: string; latencyMs: number; success: boolean }[]) =>
    set((state) => {
      let changed = false;
      const servers = state.servers.map((s) => {
        const r = results.find((x) => x.serverId === s.id);
        if (r && r.success && s.latency !== r.latencyMs) {
          changed = true;
          return { ...s, latency: r.latencyMs, updatedAt: Date.now() };
        }
        return s;
      });
      const tests: DnsLatencyTest[] = results.map((r) => ({
        serverId: r.serverId,
        address: '',
        latencyMs: r.latencyMs,
        success: r.success,
      }));
      // 若所有 latency 均无变化，只追加 tests（总量受 MAX_LATENCY_HISTORY 限制）
      if (!changed && tests.length === 0) return {};
      return {
        servers: changed ? servers : state.servers,
        latencyTests: [...tests, ...state.latencyTests].slice(0, MAX_LATENCY_HISTORY),
      };
    }),

  setHealthStatus: (status) => set({ healthStatus: status }),

  setIsTesting: (v) => set({ isTesting: v }),
  setIsSwitching: (v) => set({ isSwitching: v }),
  setSwitchingServerId: (id) => set({ switchingServerId: id }),
  setTestingServerId: (id) => set({ testingServerId: id }),
  setError: (error) => set({ error }),
}));
