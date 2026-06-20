// ============================================================
// DNS 状态操作 Hook
// 封装 DNS 切换、重置、延迟测试、泄露检测等核心操作
// ============================================================

import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/log';
import i18n from '@/i18n';
import { useDnsStore } from '@/stores';
import { useDnsServers } from './useDnsServers';
import type { DnsStatus, DnsLatencyTest, DnsLeakResult } from '@/types';

export function useDnsStatus() {
  const {
    currentStatus,
    isTesting,
    isSwitching,
    error,
    lastLeakResult,
    switchingServerId,
    testingServerId,
    setCurrentStatus,
    setIsTesting,
    setIsSwitching,
    setError,
    setLastLeakResult,
    setSwitchingServerId,
    setTestingServerId,
  } = useDnsStore();
  const { servers } = useDnsServers();

  /** 从系统获取当前 DNS 状态，并匹配服务器列表推断当前活跃服务器 */
  const fetchStatus = useCallback(async () => {
    try {
      const status = await invoke<DnsStatus>('get_current_dns');
      setCurrentStatus(status);
      setError(null);
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
      setError(String(e));
    }
  }, [setCurrentStatus, setError]);

  /** 切换到指定 DNS 服务器 */
  const switchDns = useCallback(
    async (serverId: string) => {
      const server = servers.find((s) => s.id === serverId);
      if (!server) {
        setError(`${i18n.t('server.not_found', { id: serverId })}`);
        return;
      }

      setIsSwitching(true);
      setSwitchingServerId(serverId);
      setError(null);
      setLastLeakResult(null);
      try {
        // 调用 Rust 后端切换 DNS
        await invoke('switch_dns', {
          serverId: server.id,
          serverName: server.name,
          addresses: server.addresses,
        });
        logger.info(`Switched to ${server.name} (${server.addresses.join(', ')})`);
        // 更新 UI 活跃状态
        useDnsStore.getState().setActiveServer(serverId);
        // 刷新状态
        await fetchStatus();
        // 检测 DNS 泄露
        const leak = await invoke<DnsLeakResult>('check_dns_leak', {
          expectedAddresses: server.addresses,
        });
        setLastLeakResult(leak);
      } catch (e) {
        logger.error(`Failed to switch DNS to ${server.name}: ${e}`);
        setError(String(e));
      } finally {
        setIsSwitching(false);
        setSwitchingServerId(null);
      }
    },
    [servers, setIsSwitching, setSwitchingServerId, setError, fetchStatus, setLastLeakResult],
  );

  /** 重置为系统默认 DNS */
  const resetToSystem = useCallback(async () => {
    setIsSwitching(true);
    setError(null);
    setLastLeakResult(null);
    try {
      logger.info('Reset to system DNS');
      await invoke('reset_system_dns');
      useDnsStore.getState().clearActive();
      await fetchStatus();
    } catch (e) {
      logger.error(`Failed to reset DNS: ${e}`);
      setError(String(e));
    } finally {
      setIsSwitching(false);
    }
  }, [setIsSwitching, setError, setLastLeakResult, fetchStatus]);

  /** 测试指定服务器的延迟 */
  const testLatency = useCallback(
    async (serverId: string) => {
      const server = servers.find((s) => s.id === serverId);
      if (!server || server.addresses.length === 0) {
        setError(i18n.t('server.no_addresses'));
        return null;
      }

      setIsTesting(true);
      setTestingServerId(serverId);
      setError(null);
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
        setError(String(e));
        return null;
      } finally {
        setIsTesting(false);
        setTestingServerId(null);
      }
    },
    [servers, setIsTesting, setTestingServerId, setError],
  );

  // 组件挂载时获取当前 DNS 状态
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    currentStatus,
    isTesting,
    isSwitching,
    switchingServerId,
    testingServerId,
    error,
    lastLeakResult,
    fetchStatus,
    switchDns,
    resetToSystem,
    testLatency,
  };
}
