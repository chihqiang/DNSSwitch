// ============================================================
// Layout 根布局组件
// 渲染顶部导航标签栏 + 页面内容区（Outlet）+ 全局错误提示
// ============================================================

import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import { useDnsStore } from '@/stores';

export function Layout() {
  const { t } = useTranslation();
  const dnsError = useDnsStore((s) => s.error);

  /** 导航标签定义 */
  const tabs = [
    { path: '/servers', label: t('tab.servers') },
    { path: '/query', label: t('tab.query') },
    { path: '/log', label: t('tab.log') },
    { path: '/settings', label: t('tab.settings') },
  ];

  return (
    <div className="flex-1 flex flex-col p-4 gap-4">
      {/* 顶部：应用名称 + 导航标签 */}
      <header className="flex items-center justify-between pb-3 border-b border-border">
        <h1 className="text-lg font-bold">{t('app.name')}</h1>
        <nav className="flex rounded-sm border border-border overflow-hidden">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'bg-bg-card text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* 页面内容（由 React Router 注入） */}
      <main className="flex-1 flex flex-col gap-4 overflow-y-auto">
        {dnsError && (
          <div className="px-3 py-2 bg-danger-bg text-danger border border-danger/20 rounded text-xs">
            {t('status.error_hint', { message: dnsError })}
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
