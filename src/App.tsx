// ============================================================
// App 根组件
// 负责：配置加载、Tauri 事件监听（健康检查/延迟更新）、路由、Toast 通知
// ============================================================

import { Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { logger } from '@/lib/log';
import { Layout } from '@/components/Layout/Layout';
import { ServersPage } from '@/pages/ServersPage';
import { QueryPage } from '@/pages/QueryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LogPage } from '@/pages/LogPage';
import { StatusBar } from '@/components/StatusBar';
import { ErrorBoundary, LoadingSpinner } from '@/components/common';
import { useConfig } from '@/hooks';
import { useDnsStore } from '@/stores';
import type { DnsHealthEvent, DnsLatencyUpdate } from '@/types';

function AppContent() {
  const { loadConfig } = useConfig();
  const setHealthStatus = useDnsStore((s) => s.setHealthStatus);

  // 应用启动时加载配置
  useEffect(() => {
    loadConfig();
    logger.info('DNSSwitch UI started');
  }, [loadConfig]);

  // 监听 DNS 健康检查事件（Rust 后端推送）
  useEffect(() => {
    const unlisten = listen<DnsHealthEvent>('dns-health-changed', (event) => {
      setHealthStatus(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setHealthStatus]);

  // 监听全部服务器延迟更新（Rust monitor 推送，替代前端轮询）
  useEffect(() => {
    const unlisten = listen<DnsLatencyUpdate>('dns-latency-changed', (event) => {
      const { updateServer, addLatencyTest } = useDnsStore.getState();
      for (const r of event.payload.results) {
        if (r.success) {
          updateServer(r.serverId, { latency: r.latencyMs });
        }
        addLatencyTest({
          serverId: r.serverId,
          address: '',
          latencyMs: r.latencyMs,
          success: r.success,
        });
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/servers" element={<ServersPage />} />
          <Route path="/query" element={<QueryPage />} />
          <Route path="/log" element={<LogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* 默认重定向到服务器页 */}
          <Route path="*" element={<Navigate to="/servers" replace />} />
        </Route>
      </Routes>
      <StatusBar />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner size={24} />
          </div>
        }
      >
        <HashRouter>
          <AppContent />
        </HashRouter>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
