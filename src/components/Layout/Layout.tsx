import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

export function Layout() {
  const { t } = useTranslation();

  const tabs = [
    { path: '/servers', label: t('tab.servers') },
    { path: '/query', label: t('tab.query') },
    { path: '/log', label: t('tab.log') },
    { path: '/settings', label: t('tab.settings') },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex items-center justify-center px-5 py-2.5 border-b border-border/50">
        <nav className="flex gap-px bg-border rounded-md p-0.5" aria-label={t('tab.servers')}>
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `px-4 py-1 text-[13px] font-medium rounded-[4px] transition-all duration-150 ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 flex flex-col gap-4 overflow-y-auto px-5 py-4">
        <Outlet />
      </main>
    </div>
  );
}
