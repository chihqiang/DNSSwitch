// ============================================================
// 应用配置状态管理 Store（Zustand）
// 管理应用配置的读写、调度规则的增删改、用户设置等
// ============================================================

import { create } from 'zustand';
import type { AppConfig, ScheduleRule } from '@/types';
import { DEFAULT_CONFIG } from '@/types';

interface ConfigState {
  /** 当前应用配置 */
  config: AppConfig;
  /** 配置是否已从后端加载 */
  isLoaded: boolean;
  /** 是否正在保存配置 */
  isSaving: boolean;
  /** 错误信息 */
  error: string | null;

  setConfig: (config: AppConfig) => void;
  updateConfig: (updates: Partial<AppConfig>) => void;
  setIsLoaded: (v: boolean) => void;
  setIsSaving: (v: boolean) => void;
  setError: (error: string | null) => void;
  /** 调度规则操作 */
  addScheduleRule: (rule: ScheduleRule) => void;
  removeScheduleRule: (id: string) => void;
  updateScheduleRule: (id: string, updates: Partial<ScheduleRule>) => void;
  reorderScheduleRules: (rules: ScheduleRule[]) => void;
  setScheduleEnabled: (enabled: boolean) => void;
  /** 设置操作 */
  updateSettings: (updates: Partial<AppConfig['settings']>) => void;
  updateTheme: (mode: AppConfig['theme']['mode']) => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: DEFAULT_CONFIG,
  isLoaded: false,
  isSaving: false,
  error: null,

  setConfig: (config) => set({ config, isLoaded: true }),

  updateConfig: (updates) => set((state) => ({ config: { ...state.config, ...updates } })),

  setIsLoaded: (v) => set({ isLoaded: v }),
  setIsSaving: (v) => set({ isSaving: v }),
  setError: (error) => set({ error }),

  // ---- 调度规则 ----

  addScheduleRule: (rule) =>
    set((state) => ({
      config: {
        ...state.config,
        schedule: {
          ...state.config.schedule,
          rules: [...state.config.schedule.rules, rule],
        },
      },
    })),

  removeScheduleRule: (id) =>
    set((state) => ({
      config: {
        ...state.config,
        schedule: {
          ...state.config.schedule,
          rules: state.config.schedule.rules.filter((r) => r.id !== id),
        },
      },
    })),

  updateScheduleRule: (id, updates) =>
    set((state) => ({
      config: {
        ...state.config,
        schedule: {
          ...state.config.schedule,
          rules: state.config.schedule.rules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        },
      },
    })),

  reorderScheduleRules: (rules) =>
    set((state) => ({
      config: {
        ...state.config,
        schedule: { ...state.config.schedule, rules },
      },
    })),

  setScheduleEnabled: (enabled) =>
    set((state) => ({
      config: {
        ...state.config,
        schedule: { ...state.config.schedule, enabled },
      },
    })),

  // ---- 设置 ----

  updateSettings: (updates) =>
    set((state) => ({
      config: {
        ...state.config,
        settings: { ...state.config.settings, ...updates },
      },
    })),

  updateTheme: (mode) =>
    set((state) => ({
      config: {
        ...state.config,
        theme: { mode },
      },
    })),
}));
