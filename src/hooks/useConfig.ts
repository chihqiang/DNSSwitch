// ============================================================
// 配置管理 Hook
// 封装配置的加载与保存，桥接 React 组件与 Rust 后端
// ============================================================

import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/log';
import { useConfigStore } from '@/stores';
import type { AppConfig } from '@/types';

export function useConfig() {
  const config = useConfigStore((s) => s.config);
  const isLoaded = useConfigStore((s) => s.isLoaded);
  const isSaving = useConfigStore((s) => s.isSaving);
  const error = useConfigStore((s) => s.error);

  /** 从 Rust 后端加载配置 */
  const loadConfig = useCallback(async () => {
    try {
      const result = await invoke<AppConfig>('load_config');
      useConfigStore.getState().setConfig(result);
      logger.info(`Configuration loaded (${result.servers.length} servers)`);
      useConfigStore.getState().setError(null);
    } catch (e) {
      logger.error(`Failed to load configuration: ${e}`);
      useConfigStore.getState().setError(String(e));
    } finally {
      useConfigStore.getState().setIsLoaded(true);
    }
  }, []);

  /** 将当前配置保存到 Rust 后端 */
  const saveConfig = useCallback(async () => {
    useConfigStore.getState().setIsSaving(true);
    useConfigStore.getState().setError(null);
    const current = useConfigStore.getState().config;
    try {
      await invoke('save_config', { config: current });
      useConfigStore.getState().setError(null);
    } catch (e) {
      logger.error(`Failed to save configuration: ${e}`);
      useConfigStore.getState().setError(String(e));
    } finally {
      useConfigStore.getState().setIsSaving(false);
    }
  }, []);

  return {
    config,
    isLoaded,
    isSaving,
    error,
    loadConfig,
    saveConfig,
  };
}
