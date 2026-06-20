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
    setCurrentStatus,
    setIsTesting,
    setIsSwitching,
    setError,
    setLastLeakResult,
  } = useDnsStore();
  const { servers } = useDnsServers();

  const fetchStatus = useCallback(async () => {
    try {
      const status = await invoke<DnsStatus>('get_current_dns');
      setCurrentStatus(status);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [setCurrentStatus, setError]);

  const switchDns = useCallback(
    async (serverId: string) => {
      const server = servers.find((s) => s.id === serverId);
      if (!server) {
        setError(`${i18n.t('server.not_found', { id: serverId })}`);
        return;
      }

      setIsSwitching(true);
      setError(null);
      setLastLeakResult(null);
      try {
        await invoke('switch_dns', {
          serverId: server.id,
          serverName: server.name,
          addresses: server.addresses,
        });
        await fetchStatus();
        const leak = await invoke<DnsLeakResult>('check_dns_leak', {
          expectedAddresses: server.addresses,
        });
        setLastLeakResult(leak);
      } catch (e) {
        setError(String(e));
      } finally {
        setIsSwitching(false);
      }
    },
    [servers, setIsSwitching, setError, fetchStatus, setLastLeakResult],
  );

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

  const testLatency = useCallback(
    async (serverId: string) => {
      const server = servers.find((s) => s.id === serverId);
      if (!server || server.addresses.length === 0) {
        setError(i18n.t('server.no_addresses'));
        return null;
      }

      setIsTesting(true);
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
      }
    },
    [servers, setIsTesting, setError],
  );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    currentStatus,
    isTesting,
    isSwitching,
    error,
    lastLeakResult,
    fetchStatus,
    switchDns,
    resetToSystem,
    testLatency,
  };
}
