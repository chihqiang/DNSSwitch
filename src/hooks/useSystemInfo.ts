import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SystemInfo, NetworkService } from '@/types';

export function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [networkServices, setNetworkServices] = useState<NetworkService[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSystemInfo = useCallback(async () => {
    try {
      const info = await invoke<SystemInfo>('get_system_info');
      setSystemInfo(info);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchNetworkServices = useCallback(async () => {
    try {
      const services = await invoke<NetworkService[]>('get_network_services');
      setNetworkServices(services);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchSystemInfo(), fetchNetworkServices()]).finally(() => setLoading(false));
  }, [fetchSystemInfo, fetchNetworkServices]);

  return { systemInfo, networkServices, loading };
}
