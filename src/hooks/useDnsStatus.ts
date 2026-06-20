// ============================================================
// DNS 状态操作 Hook
// 封装 DNS 切换、重置、延迟测试、泄露检测等核心操作
// ============================================================

import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
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

  /** 从系统获取当前 DNS 状态 */
  const fetchStatus = useCallback(async () => {
    try {
      const status = await invoke<DnsStatus>('get_current_dns');
      setCurrentStatus(status);
      setError(null);
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
        // 刷新状态
        await fetchStatus();
        // 检测 DNS 泄露
        const leak = await invoke<DnsLeakResult>('check_dns_leak', {
          expectedAddresses: server.addresses,
        });
        setLastLeakResult(leak);
      } catch (e) {
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
      await invoke('reset_system_dns');
      await fetchStatus();
    } catch (e) {
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
