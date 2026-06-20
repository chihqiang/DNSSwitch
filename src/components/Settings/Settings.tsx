// ============================================================
// Settings 设置面板组件
// 包含常规设置、系统信息、历史记录、工具（导入/导出）四个标签页
// ============================================================

import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { enable as enableAutostart, disable as disableAutostart } from '@tauri-apps/plugin-autostart';
import { logger } from '@/lib/log';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '@/stores';
import { ThemeMode, type AppConfig } from '@/types';
import { useSystemInfo } from '@/hooks';
import { Card, Button, ButtonVariant, LoadingSpinner } from '@/components/common';
import { HistoryPanel } from '@/components/HistoryPanel/HistoryPanel';
import { LATENCY_CHECK_INTERVAL_MIN_S, LATENCY_CHECK_INTERVAL_MAX_S } from '@/constants';

interface SettingsProps {
  onSave: () => void;
}

/** 支持的语言列表 */
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
];

/** 主题选项 */
const THEME_OPTIONS = [
  { value: ThemeMode.SYSTEM, key: 'theme.system' },
  { value: ThemeMode.LIGHT, key: 'theme.light' },
  { value: ThemeMode.DARK, key: 'theme.dark' },
];

/** 设置标签页定义 */
const TABS = [
  { key: 'general', labelKey: 'settings.general' },
  { key: 'system', labelKey: 'settings.system_info' },
  { key: 'history', labelKey: 'history.title' },
  { key: 'tools', labelKey: 'settings.tools' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** 系统信息行（标签: 值） */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="text-xs text-text-muted w-24 shrink-0">{label}</span>
      <span className="text-xs text-text-primary truncate">{value}</span>
    </div>
  );
}

export function Settings({ onSave }: SettingsProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const { config, updateSettings, updateTheme, isSaving, error, setConfig } = useConfigStore();
  const { systemInfo, networkServices, loading: systemLoading } = useSystemInfo();
  const { settings } = config;

  // ---- 导入/导出 ----

  /** 导出配置为 JSON 文件 */
  const handleExport = useCallback(async () => {
    const path = await save({
      title: t('settings.export_config'),
      defaultPath: 'dnsswitch-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!path) return;
    try {
      await invoke('export_config', { filePath: path });
      alert(t('settings.export_success'));
    } catch (e) {
      alert(`${t('settings.export_failed')}: ${e}`);
    }
  }, [t]);

  /** 从 JSON 文件导入配置 */
  const handleImport = useCallback(async () => {
    const path = await open({
      title: t('settings.import_config'),
      filters: [{ name: 'JSON', extensions: ['json'] }],
      multiple: false,
      directory: false,
    });
    if (!path) return;
    try {
      const cfg = await invoke('import_config', { filePath: path });
      setConfig(cfg as AppConfig);
      alert(t('settings.import_success'));
    } catch (e) {
      alert(`${t('settings.import_failed')}: ${e}`);
    }
  }, [t, setConfig]);

  /** 切换语言 */
  function handleLanguageChange(lng: string) {
    i18n.changeLanguage(lng);
  }

  // ---- 标签页头部 ----

  const tabHeader = (
    <div className="flex gap-1 border-b border-border pb-2">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`px-3 py-1.5 text-sm rounded transition-colors duration-150 ${
            activeTab === tab.key
              ? 'bg-accent text-white font-medium'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
          }`}
          onClick={() => setActiveTab(tab.key)}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );

  // ---- 常规设置标签页 ----

  const generalTab = (
    <div className="flex flex-col gap-4">
      {/* 通用开关 */}
      <section>
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.general')}</h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
            <input
              type="checkbox"
              className="w-4 h-4 accent-accent rounded"
              checked={settings.autoStart}
              onChange={async (e) => {
                updateSettings({ autoStart: e.target.checked });
                try {
                  if (e.target.checked) {
                    await enableAutostart();
                  } else {
                    await disableAutostart();
                  }
                } catch (err) {
                  logger.error(`Failed to toggle autostart: ${err}`);
                }
              }}
            />
            <span className="text-sm">{t('settings.auto_start')}</span>
          </label>

          <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
            <input
              type="checkbox"
              className="w-4 h-4 accent-accent rounded"
              checked={settings.minimizeToTray}
              onChange={(e) => updateSettings({ minimizeToTray: e.target.checked })}
            />
            <span className="text-sm">{t('settings.minimize_to_tray')}</span>
          </label>

          <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
            <input
              type="checkbox"
              className="w-4 h-4 accent-accent rounded"
              checked={settings.notifyOnSwitch}
              onChange={(e) => updateSettings({ notifyOnSwitch: e.target.checked })}
            />
            <span className="text-sm">{t('settings.notify_on_switch')}</span>
          </label>

          <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
            <input
              type="checkbox"
              className="w-4 h-4 accent-accent rounded"
              checked={settings.checkUpdates}
              onChange={(e) => updateSettings({ checkUpdates: e.target.checked })}
            />
            <span className="text-sm">{t('settings.check_updates')}</span>
          </label>
        </div>
      </section>

      {/* 性能设置 */}
      <section>
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
          {t('settings.performance')}
        </h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
            <span className="text-sm">{t('settings.latency_interval')}</span>
            <input
              type="number"
              className="px-2 py-1 border border-border rounded bg-bg-card text-text-primary text-sm w-20 text-center ml-auto"
              value={Math.round(settings.latencyCheckInterval / 1000)}
              min={LATENCY_CHECK_INTERVAL_MIN_S}
              max={LATENCY_CHECK_INTERVAL_MAX_S}
              onChange={(e) =>
                updateSettings({
                  latencyCheckInterval: Number(e.target.value) * 1000,
                })
              }
            />
            <span className="text-xs text-text-muted">s</span>
          </label>
        </div>
      </section>

      {/* 外观设置 */}
      <section>
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
          {t('settings.appearance')}
        </h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
            <span className="text-sm">{t('settings.language')}</span>
            <select
              className="ml-auto px-2 py-1 border border-border rounded bg-bg-card text-text-primary text-sm"
              value={LANGUAGES.find((l) => i18n.language.startsWith(l.value))?.value ?? LANGUAGES[0].value}
              onChange={(e) => handleLanguageChange(e.target.value)}
            >
              {LANGUAGES.map((lng) => (
                <option key={lng.value} value={lng.value}>
                  {lng.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
            <span className="text-sm">{t('settings.theme_mode')}</span>
            <select
              className="ml-auto px-2 py-1 border border-border rounded bg-bg-card text-text-primary text-sm"
              value={config.theme.mode}
              onChange={(e) => updateTheme(e.target.value as (typeof ThemeMode)[keyof typeof ThemeMode])}
            >
              {THEME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.key)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <Button variant={ButtonVariant.PRIMARY} onClick={onSave} isLoading={isSaving}>
          {t('settings.save')}
        </Button>
      </div>
    </div>
  );

  // ---- 系统信息标签页 ----

  const systemTab = (
    <div className="flex flex-col gap-4">
      {systemLoading ? (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size={20} />
        </div>
      ) : (
        <>
          {systemInfo && (
            <section>
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                {t('settings.system_info')}
              </h3>
              <div className="bg-bg-secondary rounded">
                <InfoRow label={t('settings.os')} value={systemInfo.os} />
                <InfoRow label={t('settings.os_version')} value={systemInfo.osVersion} />
                <InfoRow label={t('settings.hostname')} value={systemInfo.hostname} />
                <InfoRow label={t('settings.kernel')} value={systemInfo.kernelVersion} />
              </div>
            </section>
          )}

          {networkServices.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                {t('settings.network_services')}
              </h3>
              <div className="bg-bg-secondary rounded">
                {networkServices.map((svc) => (
                  <div
                    key={svc.name}
                    className="flex items-center gap-2 px-3 py-1.5 border-b border-border last:border-b-0"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${svc.isActive ? 'bg-success' : 'bg-text-muted'}`}
                    />
                    <span className="text-xs text-text-primary">{svc.displayName}</span>
                    {svc.dnsServers.length > 0 && (
                      <span className="text-xs text-text-muted ml-auto">{svc.dnsServers.join(', ')}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );

  // ---- 历史记录标签页 ----

  const historyTab = <HistoryPanel />;

  // ---- 工具标签页 ----

  const toolsTab = (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-muted">{t('settings.tools_desc')}</p>
      <div className="flex items-center gap-2">
        <Button variant={ButtonVariant.SECONDARY} onClick={handleExport}>
          {t('settings.export')}
        </Button>
        <Button variant={ButtonVariant.SECONDARY} onClick={handleImport}>
          {t('settings.import')}
        </Button>
      </div>
    </div>
  );

  /** 标签页内容映射 */
  const tabContent: Record<TabKey, React.ReactNode> = {
    general: generalTab,
    system: systemTab,
    history: historyTab,
    tools: toolsTab,
  };

  return (
    <Card className="flex flex-col gap-3 p-3">
      <h2 className="text-sm font-semibold">{t('settings.title')}</h2>
      {tabHeader}
      {tabContent[activeTab]}
    </Card>
  );
}
