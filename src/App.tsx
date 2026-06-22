// ============================================================
// App 根组件
// 负责：配置加载、Tauri 事件监听（健康检查/延迟更新）、路由、Toast 通知
// ============================================================

import { Suspense, useEffect, lazy } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { logger } from '@/lib/log';
import { Layout } from '@/components/Layout/Layout';
import { StatusBar } from '@/components/StatusBar';
import { ErrorBoundary, LoadingSpinner, ToastContainer } from '@/components/common';
import { useNProgress } from '@/hooks/useNProgress';
import { useConfig } from '@/hooks';
import { useConfigStore, useDnsStore } from '@/stores';
import { ThemeMode } from '@/types';
import type { DnsHealthEvent, DnsLatencyUpdate } from '@/types';

const ServersPage = lazy(() => import('@/pages/ServersPage').then((m) => ({ default: m.ServersPage })));
const QueryPage = lazy(() => import('@/pages/QueryPage').then((m) => ({ default: m.QueryPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const LogPage = lazy(() => import('@/pages/LogPage').then((m) => ({ default: m.LogPage })));

function AppContent() {
  useNProgress();
  const { loadConfig } = useConfig();
  const setHealthStatus = useDnsStore((s) => s.setHealthStatus);
  const themeMode = useConfigStore((s) => s.config.theme.mode);

  // 应用启动时加载配置
  useEffect(() => {
    loadConfig();
    logger.info('DNSSwitch UI started');
  }, [loadConfig]);

  // 根据主题设置（System/Light/Dark）更新 html 属性，覆盖 CSS 变量
  useEffect(() => {
    const html = document.documentElement;
    if (themeMode === ThemeMode.LIGHT) {
      html.dataset.theme = 'light';
    } else if (themeMode === ThemeMode.DARK) {
      html.dataset.theme = 'dark';
    } else {
      // System mode: 清除属性，由 prefers-color-scheme 决定
      delete html.dataset.theme;
    }
  }, [themeMode]);

  // 监听 DNS 健康检查事件（Rust 后端推送）
  useEffect(() => {
    const unlistenPromise = listen<DnsHealthEvent>('dns-health-changed', (event) => {
      setHealthStatus(event.payload);
    }).catch((err) => {
      logger.error(`Failed to register health listener: ${err}`);
      return () => {};
    });
    return () => {
      unlistenPromise
        .then((fn) => fn())
        .catch((err) => {
          logger.error(`Failed to unlisten health: ${err}`);
        });
    };
  }, [setHealthStatus]);

  // 监听全部服务器延迟更新（Rust monitor 推送，替代前端轮询）
  useEffect(() => {
    const unlistenPromise = listen<DnsLatencyUpdate>('dns-latency-changed', (event) => {
      useDnsStore.getState().batchUpdateFromMonitor(event.payload.results);
    }).catch((err) => {
      logger.error(`Failed to register latency listener: ${err}`);
      return () => {};
    });
    return () => {
      unlistenPromise
        .then((fn) => fn())
        .catch((err) => {
          logger.error(`Failed to unlisten latency: ${err}`);
        });
    };
  }, []);

  return (
    <div className="flex flex-col h-screen">
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
      <ToastContainer />
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
