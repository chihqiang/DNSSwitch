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
    provider: p
      ? { name: p.name, displayName: p.displayName, website: p.website, description: p.description }
      : { name: def.providerKey, displayName: def.name },
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
  const servers = useDnsStore((s) => s.servers);

  /** 从 Rust 后端加载提供商注册表，构建服务器列表 */
  const loadServers = useCallback(async () => {
    if (!useConfigStore.getState().isLoaded) return;
    try {
      const registry = await invoke<ProviderRegistry>('get_provider_registry');
      const dnsServers = registry.servers.map((def) => serverDefToDnsServer(def, registry.providers));
      useDnsStore.getState().setServers(dnsServers);

      // 恢复上次激活的服务器（从持久化的 config 中读取）
      const { config: currentConfig } = useConfigStore.getState();
      if (currentConfig.activeServerId) {
        useDnsStore.getState().setActiveServer(currentConfig.activeServerId);
      }

      // 同步到 config.servers 以保持向后兼容
      if (currentConfig.servers.length === 0) {
        useConfigStore.getState().setConfig({ ...currentConfig, servers: dnsServers });
      }
    } catch (e) {
      logger.error(`Failed to load provider registry: ${e}`);
    }
  }, []);

  /** 添加自定义 DNS 服务器，同时持久化到 Rust 后端 */
  const addCustomServer = useCallback(async (server: DnsServer) => {
    useDnsStore.getState().addServer(server);
    const { config } = useConfigStore.getState();
    useConfigStore.getState().setConfig({
      ...config,
      servers: [...config.servers, server],
    });
    try {
      await invoke('add_server_to_registry', { server: dnsServerToServerDef(server) });
    } catch (e) {
      logger.error(`Failed to persist new server: ${e}`);
    }
  }, []);

  /** 删除 DNS 服务器，同时从 Rust 后端移除 */
  const deleteServer = useCallback(async (id: string) => {
    useDnsStore.getState().removeServer(id);
    const { config } = useConfigStore.getState();
    const updatedConfig = {
      ...config,
      servers: config.servers.filter((s) => s.id !== id),
    };
    if (config.activeChromeServerId === id) {
      updatedConfig.activeChromeServerId = undefined;
    }
    useConfigStore.getState().setConfig(updatedConfig);
    try {
      await invoke('delete_server_from_registry', { id });
      if (config.activeChromeServerId === id) {
        await invoke('reset_chrome_doh');
      }
    } catch (e) {
      logger.error(`Failed to delete server from registry: ${e}`);
    }
  }, []);

  /** 编辑 DNS 服务器，同时持久化到 Rust 后端 */
  const editServer = useCallback(async (id: string, updates: Partial<DnsServer>) => {
    useDnsStore.getState().updateServer(id, updates);
    const { config } = useConfigStore.getState();
    const existing = config.servers.find((s) => s.id === id);
    if (!existing) {
      logger.error(`editServer: server not found: ${id}`);
      return;
    }
    const updated = { ...existing, ...updates };
    useConfigStore.getState().setConfig({
      ...config,
      servers: config.servers.map((s) => (s.id === id ? updated : s)),
    });
    try {
      await invoke('update_server_in_registry', { id, updates: dnsServerToServerDef(updated) });
    } catch (e) {
      logger.error(`Failed to update server in registry: ${e}`);
    }
  }, []);

  /** 刷新所有服务器的延迟数据（Rust 端并行，一次 IPC） */
  const refreshLatency = useCallback(async () => {
    const currentServers = useDnsStore.getState().servers;
    const inputs = currentServers
      .filter((s) => s.addresses.length > 0)
      .map((s) => ({ serverId: s.id, address: s.addresses[0] }));
    if (inputs.length === 0) return;
    try {
      const results = await invoke<DnsLatencyTest[]>('test_all_dns_latency', { servers: inputs });
      const { updateServer, addLatencyTest } = useDnsStore.getState();
      for (const r of results) {
        if (r.success) {
          updateServer(r.serverId, { latency: r.latencyMs });
        }
        addLatencyTest(r);
      }
    } catch (e) {
      logger.error(`Failed to refresh latency: ${e}`);
    }
  }, []);

  /** 恢复系统 DNS 为默认（清除自定义 DNS） */
  const resetToSystem = useCallback(async () => {
    try {
      await invoke('reset_system_dns');
      useDnsStore.getState().clearActive();
      const { config: currentConfig } = useConfigStore.getState();
      useConfigStore.getState().setConfig({ ...currentConfig, activeServerId: undefined });
      logger.info('System DNS reset to default');
    } catch (e) {
      logger.error(`Failed to reset system DNS: ${e}`);
    }
  }, []);

  // 配置加载完成后，从 Rust 加载服务器列表
  const isLoaded = useConfigStore((s) => s.isLoaded);
  useEffect(() => {
    if (isLoaded) loadServers();
  }, [isLoaded, loadServers]);

  return {
    servers,
    addCustomServer,
    deleteServer,
    editServer,
    refreshLatency,
    resetToSystem,
  };
}
