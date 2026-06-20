// ============================================================
// DNS 服务器管理 Hook
// 封装服务器的 CRUD 操作、延迟刷新、与配置同步等功能
// ============================================================

import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useDnsStore, useConfigStore } from '@/stores';
import { PRESET_SERVERS } from '@/types';
import type { DnsServer, DnsLatencyTest } from '@/types';

export function useDnsServers() {
  const { servers, setServers, addServer, removeServer, updateServer } = useDnsStore();
  const { config, isLoaded, setConfig } = useConfigStore();

  // 使用 getState() 读取 config.servers，避免将 config.servers 放入 deps 导致循环依赖
  const loadServers = useCallback(() => {
    if (!isLoaded) return;
    const { config: currentConfig } = useConfigStore.getState();
    if (currentConfig.servers.length > 0) {
      setServers(currentConfig.servers);
    } else {
      // 首次使用：加载预设服务器列表
      setServers(PRESET_SERVERS);
    }
  }, [isLoaded, setServers]);

  /** 添加自定义 DNS 服务器，同时同步到 config store */
  const addCustomServer = useCallback(
    async (server: DnsServer) => {
      addServer(server);
      setConfig({
        ...config,
        servers: [...config.servers, server],
      });
    },
    [addServer, config, setConfig],
  );

  /** 删除 DNS 服务器，同时同步到 config store */
  const deleteServer = useCallback(
    async (id: string) => {
      removeServer(id);
      setConfig({
        ...config,
        servers: config.servers.filter((s) => s.id !== id),
      });
    },
    [removeServer, config, setConfig],
  );

  /** 编辑 DNS 服务器，同时同步到 config store */
  const editServer = useCallback(
    async (id: string, updates: Partial<DnsServer>) => {
      updateServer(id, updates);
      setConfig({
        ...config,
        servers: config.servers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      });
    },
    [updateServer, config, setConfig],
  );

  /** 刷新所有服务器的延迟数据 */
  const refreshLatency = useCallback(async () => {
    const currentServers = useDnsStore.getState().servers;
    const results = await Promise.allSettled(
      currentServers
        .filter((s) => s.addresses.length > 0)
        .map((server) =>
          invoke<DnsLatencyTest>('test_dns_latency', {
            serverId: server.id,
            address: server.addresses[0],
          }),
        ),
    );
    const { updateServer, addLatencyTest } = useDnsStore.getState();
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        updateServer(result.value.serverId, {
          latency: result.value.latencyMs,
        });
        addLatencyTest(result.value);
      }
    }
  }, []);

  // 配置加载完成后，同步服务器列表
  useEffect(() => {
    loadServers();
  }, [loadServers]);

  // 按配置的间隔定时刷新延迟
  useEffect(() => {
    if (!isLoaded || !config.settings.latencyCheckInterval) return;
    const id = setInterval(refreshLatency, config.settings.latencyCheckInterval);
    return () => clearInterval(id);
  }, [isLoaded, config.settings.latencyCheckInterval, refreshLatency]);

  return {
    servers,
    addCustomServer,
    deleteServer,
    editServer,
    refreshLatency,
  };
}
