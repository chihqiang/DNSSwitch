// ============================================================
// DNS 状态操作 Hook
// 封装 DNS 切换、重置、延迟测试、泄露检测等核心操作
// ============================================================

import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/log';
import i18n from '@/i18n';
import { useDnsStore, useConfigStore } from '@/stores';
import { useToastStore } from '@/stores/toastStore';
import type { DnsStatus, DnsLatencyTest, DnsLeakResult } from '@/types';

export function useDnsStatus() {
  // 仅订阅需要的字段，避免 healthStatus 更新（每 5s）触发不必要的重渲染
  const currentStatus = useDnsStore((s) => s.currentStatus);
  const isTesting = useDnsStore((s) => s.isTesting);
  const isSwitching = useDnsStore((s) => s.isSwitching);
  const error = useDnsStore((s) => s.error);
  const lastLeakResult = useDnsStore((s) => s.lastLeakResult);
  const switchingServerId = useDnsStore((s) => s.switchingServerId);
  const chromeSwitchingServerId = useDnsStore((s) => s.chromeSwitchingServerId);
  const testingServerId = useDnsStore((s) => s.testingServerId);

  /** 从系统获取当前 DNS 状态，并匹配服务器列表推断当前活跃服务器 */
  const fetchStatus = useCallback(async () => {
    try {
      const status = await invoke<DnsStatus>('get_current_dns');
      useDnsStore.getState().setCurrentStatus(status);
      useDnsStore.getState().setError(null);
      // 根据系统 DNS 地址匹配活跃服务器
      const allServers = useDnsStore.getState().servers;
      if (status.isCustom && status.currentServers.length > 0) {
        const sorted = [...status.currentServers].sort();
        const match = allServers.find((s) => {
          const addrs = [...s.addresses].sort();
          return addrs.length === sorted.length && addrs.every((a, i) => a === sorted[i]);
        });
        if (match) {
          useDnsStore.getState().setActiveServer(match.id);
        }
      }
    } catch (e) {
      useDnsStore.getState().setError(String(e));
    }
  }, []);

  /** 切换到指定 DNS 服务器（仅系统 DNS） */
  const switchDns = useCallback(
    async (serverId: string) => {
      const servers = useDnsStore.getState().servers;
      const server = servers.find((s) => s.id === serverId);
      if (!server) {
        useDnsStore.getState().setError(`${i18n.t('server.not_found', { id: serverId })}`);
        return;
      }

      if (server.addresses.length === 0) {
        useDnsStore.getState().setError(i18n.t('server.no_addresses'));
        return;
      }

      useDnsStore.getState().setIsSwitching(true);
      useDnsStore.getState().setSwitchingServerId(serverId);
      useDnsStore.getState().setError(null);
      useDnsStore.getState().setLastLeakResult(null);
      try {
        await invoke('switch_dns', {
          serverId: server.id,
          serverName: server.name,
          addresses: server.addresses,
        });
        logger.info(`Switched system DNS to ${server.name} (${server.addresses.join(', ')})`);
        useDnsStore.getState().setActiveServer(serverId);
        useToastStore.getState().addToast('success', i18n.t('status.switch_success', { name: server.name }));
        const [, leak] = await Promise.all([
          fetchStatus(),
          invoke<DnsLeakResult>('check_dns_leak', { expectedAddresses: server.addresses }),
        ]);
        if (leak) {
          useDnsStore.getState().setLastLeakResult(leak);
        }
      } catch (e) {
        const msg = String(e);
        logger.error(`Failed to switch DNS to ${server.name}: ${msg}`);
        useDnsStore.getState().setError(msg);
        useToastStore.getState().addToast('error', msg);
      } finally {
        useDnsStore.getState().setIsSwitching(false);
        useDnsStore.getState().setSwitchingServerId(null);
      }
    },
    [fetchStatus],
  );

  /** 切换 Chrome DoH 到指定服务器 */
  const switchChromeDoh = useCallback(
    async (serverId: string) => {
      const servers = useDnsStore.getState().servers;
      const server = servers.find((s) => s.id === serverId);
      if (!server || !server.dohUrl) {
        useToastStore.getState().addToast('error', i18n.t('server.no_doh_url'));
        return;
      }

      useDnsStore.getState().setChromeSwitchingServerId(serverId);
      try {
        await invoke('set_chrome_doh', { dohUrl: server.dohUrl, serverId });
        logger.info(`Set Chrome DoH to ${server.name} (${server.dohUrl})`);
        const { config: currentConfig } = useConfigStore.getState();
        useConfigStore.getState().setConfig({ ...currentConfig, activeChromeServerId: serverId });
        useToastStore.getState().addToast('success', i18n.t('status.chrome_switched', { name: server.name }));
        await fetchStatus();
      } catch (e) {
        const msg = String(e);
        logger.error(`Failed to set Chrome DoH: ${msg}`);
        useToastStore.getState().addToast('error', msg);
      } finally {
        useDnsStore.getState().setChromeSwitchingServerId(null);
      }
    },
    [fetchStatus],
  );

  /** 重置为系统默认 DNS */
  const resetToSystem = useCallback(async () => {
    useDnsStore.getState().setIsSwitching(true);
    useDnsStore.getState().setError(null);
    useDnsStore.getState().setLastLeakResult(null);
    try {
      logger.info('Reset to system DNS');
      await invoke('reset_system_dns');
      useDnsStore.getState().clearActive();
      useToastStore.getState().addToast('success', i18n.t('status.reset_success'));
      await fetchStatus();
    } catch (e) {
      const msg = String(e);
      logger.error(`Failed to reset DNS: ${msg}`);
      useDnsStore.getState().setError(msg);
      useToastStore.getState().addToast('error', msg);
    } finally {
      useDnsStore.getState().setIsSwitching(false);
    }
  }, [fetchStatus]);

  /** 测试指定服务器的延迟 */
  const testLatency = useCallback(async (serverId: string) => {
    const servers = useDnsStore.getState().servers;
    const server = servers.find((s) => s.id === serverId);
    if (!server || server.addresses.length === 0) {
      useDnsStore.getState().setError(i18n.t('server.no_addresses'));
      return null;
    }

    useDnsStore.getState().setIsTesting(true);
    useDnsStore.getState().setTestingServerId(serverId);
    useDnsStore.getState().setError(null);
    try {
      const result = await invoke<DnsLatencyTest>('test_dns_latency', {
        serverId: server.id,
        address: server.addresses[0],
      });
      useDnsStore.getState().addLatencyTest(result);
      if (result.success) {
        useDnsStore.getState().updateServer(serverId, {
          latency: result.latencyMs,
        });
      }
      return result;
    } catch (e) {
      logger.error(`Failed to test latency for ${server.name}: ${e}`);
      useDnsStore.getState().setError(String(e));
      return null;
    } finally {
      useDnsStore.getState().setIsTesting(false);
      useDnsStore.getState().setTestingServerId(null);
    }
  }, []);

  // 组件挂载时获取当前 DNS 状态
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    currentStatus,
    isTesting,
    isSwitching,
    switchingServerId,
    chromeSwitchingServerId,
    testingServerId,
    error,
    lastLeakResult,
    fetchStatus,
    switchDns,
    switchChromeDoh,
    resetToSystem,
    testLatency,
  };
}
