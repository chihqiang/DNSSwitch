// DNS 服务器管理 Hook
// 封装服务器的 CRUD 操作、延迟刷新、与配置同步等功能
// 服务器数据源为 Rust 后端的 dnsprovider.json

import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/log';
import { useDnsStore, useConfigStore } from '@/stores';
import type { DnsServer, DnsLatencyTest, ProviderRegistry, ServerDef } from '@/types';

/** 将 Rust ServerDef 转为前端 DnsServer（补充运行时字段） */
function serverDefToDnsServer(def: ServerDef, providers: ProviderRegistry['providers']): DnsServer {
  const p = providers.find((p) => p.key === def.providerKey);
  return {
    id: def.id,
    name: def.name,
    addresses: def.addresses,
    provider: p ? { name: p.name, displayName: p.displayName, website: p.website, description: p.description } : { name: def.providerKey, displayName: def.name },
    isActive: false,
    isSystem: false,
    tags: def.tags as DnsServer['tags'],
    dohUrl: def.dohUrl,
    dotAddress: def.dotAddress,
    createdAt: 0,
    updatedAt: 0,
  };
}

/** 将前端 DnsServer 转为 Rust ServerDef */
function dnsServerToServerDef(server: DnsServer): ServerDef {
  return {
    id: server.id,
    name: server.name,
    providerKey: server.provider.name,
    addresses: server.addresses,
    tags: server.tags,
    dohUrl: server.dohUrl,
    dotAddress: server.dotAddress,
  };
}

export function useDnsServers() {
  const { servers, setServers, addServer, removeServer, updateServer } = useDnsStore();
  const { config, isLoaded, setConfig } = useConfigStore();

  /** 从 Rust 后端加载提供商注册表，构建服务器列表 */
  const loadServers = useCallback(async () => {
    if (!isLoaded) return;
    try {
      const registry = await invoke<ProviderRegistry>('get_provider_registry');
      const dnsServers = registry.servers.map((def) => serverDefToDnsServer(def, registry.providers));
      setServers(dnsServers);

      // 恢复上次激活的服务器（从持久化的 config 中读取）
      const { config: currentConfig } = useConfigStore.getState();
      if (currentConfig.activeServerId) {
        useDnsStore.getState().setActiveServer(currentConfig.activeServerId);
      }

      // 同步到 config.servers 以保持向后兼容
      if (currentConfig.servers.length === 0) {
        setConfig({ ...currentConfig, servers: dnsServers });
      }
    } catch (e) {
      logger.error(`Failed to load provider registry: ${e}`);
    }
  }, [isLoaded, setServers, setConfig]);

  /** 添加自定义 DNS 服务器，同时持久化到 Rust 后端 */
  const addCustomServer = useCallback(
    async (server: DnsServer) => {
      addServer(server);
      setConfig({
        ...config,
        servers: [...config.servers, server],
      });
      try {
        await invoke('add_server_to_registry', { server: dnsServerToServerDef(server) });
      } catch (e) {
        logger.error(`Failed to persist new server: ${e}`);
      }
    },
    [addServer, config, setConfig],
  );

  /** 删除 DNS 服务器，同时从 Rust 后端移除 */
  const deleteServer = useCallback(
    async (id: string) => {
      removeServer(id);
      setConfig({
        ...config,
        servers: config.servers.filter((s) => s.id !== id),
      });
      try {
        await invoke('delete_server_from_registry', { id });
      } catch (e) {
        logger.error(`Failed to delete server from registry: ${e}`);
      }
    },
    [removeServer, config, setConfig],
  );

  /** 编辑 DNS 服务器，同时持久化到 Rust 后端 */
  const editServer = useCallback(
    async (id: string, updates: Partial<DnsServer>) => {
      updateServer(id, updates);
      const updated = { ...config.servers.find((s) => s.id === id)!, ...updates };
      setConfig({
        ...config,
        servers: config.servers.map((s) => (s.id === id ? updated : s)),
      });
      try {
        await invoke('update_server_in_registry', { id, updates: dnsServerToServerDef(updated) });
      } catch (e) {
        logger.error(`Failed to update server in registry: ${e}`);
      }
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

  /** 恢复系统 DNS 为默认（清除自定义 DNS） */
  const resetToSystem = useCallback(async () => {
    try {
      await invoke('reset_system_dns');
      useDnsStore.getState().clearActive();
      const { config: currentConfig } = useConfigStore.getState();
      setConfig({ ...currentConfig, activeServerId: undefined });
      logger.info('System DNS reset to default');
    } catch (e) {
      logger.error(`Failed to reset system DNS: ${e}`);
    }
  }, [setConfig]);

  // 配置加载完成后，从 Rust 加载服务器列表
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
    resetToSystem,
  };
}
