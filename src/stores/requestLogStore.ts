import { create } from 'zustand'
import type { RequestLogEntry } from '@/types'

const MAX_LOG = 200

interface RequestLogState {
  entries: RequestLogEntry[]
  addEntry: (entry: RequestLogEntry) => void
  clearEntries: () => void
}

export const useRequestLogStore = create<RequestLogState>((set) => ({
  entries: [],
  addEntry: (entry) =>
    set((s) => ({
      entries: [entry, ...s.entries].slice(0, MAX_LOG),
    })),
  clearEntries: () => set({ entries: [] }),
}))
