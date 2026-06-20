// ============================================================
// 系统信息 Hook
// 获取操作系统信息、网络服务列表
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SystemInfo, NetworkService } from '@/types';

export function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [networkServices, setNetworkServices] = useState<NetworkService[]>([]);
  const [loading, setLoading] = useState(true);

  /** 获取操作系统信息 */
  const fetchSystemInfo = useCallback(async () => {
    try {
      const info = await invoke<SystemInfo>('get_system_info');
      setSystemInfo(info);
    } catch {
      /* 静默忽略错误 */
    }
  }, []);

  /** 获取网络服务列表 */
  const fetchNetworkServices = useCallback(async () => {
    try {
      const services = await invoke<NetworkService[]>('get_network_services');
      setNetworkServices(services);
    } catch {
      /* 静默忽略错误 */
    }
  }, []);

  // 挂载时并行获取系统信息和网络服务
  useEffect(() => {
    Promise.all([fetchSystemInfo(), fetchNetworkServices()]).finally(() => setLoading(false));
  }, [fetchSystemInfo, fetchNetworkServices]);

  return { systemInfo, networkServices, loading };
}
