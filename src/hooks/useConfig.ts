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
  const { config, isLoaded, isSaving, error, setConfig, setIsLoaded, setIsSaving, setError } = useConfigStore();

  /** 从 Rust 后端加载配置 */
  const loadConfig = useCallback(async () => {
    try {
      const result = await invoke<AppConfig>('load_config');
      setConfig(result);
      logger.info(`Configuration loaded (${result.servers.length} servers, ${result.schedule.rules.length} rules)`);
      setError(null);
    } catch (e) {
      logger.error(`Failed to load configuration: ${e}`);
      setError(String(e));
    } finally {
      setIsLoaded(true);
    }
  }, [setConfig, setError, setIsLoaded]);

  /** 将当前配置保存到 Rust 后端 */
  const saveConfig = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await invoke('save_config', { config });
      setError(null);
    } catch (e) {
      logger.error(`Failed to save configuration: ${e}`);
      setError(String(e));
    } finally {
      setIsSaving(false);
    }
  }, [config, setIsSaving, setError]);

  return {
    config,
    isLoaded,
    isSaving,
    error,
    loadConfig,
    saveConfig,
  };
}
