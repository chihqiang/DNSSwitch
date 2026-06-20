import { create } from 'zustand'
import type { DnsServer, DnsStatus, DnsLatencyTest, DnsLeakResult, DnsHealthEvent } from '@/types'
import { MAX_LATENCY_HISTORY } from '@/constants'

interface DnsState {
  currentStatus: DnsStatus | null
  servers: DnsServer[]
  latencyTests: DnsLatencyTest[]
  lastLeakResult: DnsLeakResult | null
  healthStatus: DnsHealthEvent | null
  isTesting: boolean
  isSwitching: boolean
  error: string | null

  setCurrentStatus: (status: DnsStatus) => void
  setServers: (servers: DnsServer[]) => void
  addServer: (server: DnsServer) => void
  removeServer: (id: string) => void
  updateServer: (id: string, updates: Partial<DnsServer>) => void
  setActiveServer: (id: string) => void
  setLatencyTests: (tests: DnsLatencyTest[]) => void
  addLatencyTest: (test: DnsLatencyTest) => void
  setLastLeakResult: (result: DnsLeakResult | null) => void
  setHealthStatus: (status: DnsHealthEvent | null) => void
  setIsTesting: (v: boolean) => void
  setIsSwitching: (v: boolean) => void
  setError: (error: string | null) => void
}

export const useDnsStore = create<DnsState>((set) => ({
  currentStatus: null,
  servers: [],
  latencyTests: [],
  lastLeakResult: null,
  healthStatus: null,
  isTesting: false,
  isSwitching: false,
  error: null,

  setCurrentStatus: (status) => set({ currentStatus: status }),

  setServers: (servers) => set({ servers }),

  addServer: (server) =>
    set((state) => ({ servers: [...state.servers, server] })),

  removeServer: (id) =>
    set((state) => ({ servers: state.servers.filter((s) => s.id !== id) })),

  updateServer: (id, updates) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
      ),
    })),

  setActiveServer: (id) =>
    set((state) => ({
      servers: state.servers.map((s) => ({
        ...s,
        isActive: s.id === id,
        updatedAt: s.id === id ? Date.now() : s.updatedAt,
      })),
    })),

  setLatencyTests: (tests) => set({ latencyTests: tests }),

  addLatencyTest: (test) =>
    set((state) => ({
      latencyTests: [test, ...state.latencyTests].slice(0, MAX_LATENCY_HISTORY),
    })),

  setLastLeakResult: (result) => set({ lastLeakResult: result }),

  setHealthStatus: (status) => set({ healthStatus: status }),

  setIsTesting: (v) => set({ isTesting: v }),
  setIsSwitching: (v) => set({ isSwitching: v }),
  setError: (error) => set({ error }),
}))
