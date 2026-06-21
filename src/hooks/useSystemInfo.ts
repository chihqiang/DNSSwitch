// ============================================================
// 系统信息 Hook
// 获取操作系统信息、网络服务列表
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '@/lib/log';
import type { SystemInfo, NetworkService } from '@/types';

export function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [networkServices, setNetworkServices] = useState<NetworkService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 获取操作系统信息 */
  const fetchSystemInfo = useCallback(async () => {
    try {
      const info = await invoke<SystemInfo>('get_system_info');
      setSystemInfo(info);
    } catch (e) {
      logger.error(`Failed to fetch system info: ${e}`);
      setError(String(e));
    }
  }, []);

  /** 获取网络服务列表 */
  const fetchNetworkServices = useCallback(async () => {
    try {
      const services = await invoke<NetworkService[]>('get_network_services');
      setNetworkServices(services);
    } catch (e) {
      logger.error(`Failed to fetch network services: ${e}`);
      setError(String(e));
    }
  }, []);

  // 挂载时并行获取系统信息和网络服务
  useEffect(() => {
    Promise.all([fetchSystemInfo(), fetchNetworkServices()]).finally(() => setLoading(false));
  }, [fetchSystemInfo, fetchNetworkServices]);

  return { systemInfo, networkServices, loading, error };
}
