// ============================================================
// 应用配置状态管理 Store（Zustand）
// 管理应用配置的读写、调度规则的增删改、用户设置等
// ============================================================

import { create } from 'zustand';
import type { AppConfig } from '@/types';
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
