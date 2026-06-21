import { useState, useCallback, useMemo, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import { enable as enableAutostart, disable as disableAutostart } from '@tauri-apps/plugin-autostart';
import { logger } from '@/lib/log';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '@/stores';
import { useToastStore } from '@/stores/toastStore';
import { ThemeMode, type AppConfig } from '@/types';
import { useSystemInfo } from '@/hooks';
import { useDnsStore } from '@/stores';
import { Button, ButtonVariant, LoadingSpinner } from '@/components/common';
import { LATENCY_CHECK_INTERVAL_MIN_S, LATENCY_CHECK_INTERVAL_MAX_S } from '@/constants';

interface SettingsProps {
  onSave: () => void;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
];

const THEME_OPTIONS = [
  { value: ThemeMode.SYSTEM, key: 'theme.system' },
  { value: ThemeMode.LIGHT, key: 'theme.light' },
  { value: ThemeMode.DARK, key: 'theme.dark' },
];

const TABS = [
  { key: 'general', labelKey: 'settings.general' },
  { key: 'system', labelKey: 'settings.system_info' },
  { key: 'tools', labelKey: 'settings.tools' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <span className="text-xs text-text-muted w-20 shrink-0">{label}</span>
      <span className="text-xs text-text-primary truncate">{value}</span>
    </div>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-secondary rounded-lg overflow-hidden [&>*+*]:border-t [&>*+*]:border-border/50">
      {children}
    </div>
  );
}

export function Settings({ onSave }: SettingsProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const config = useConfigStore((s) => s.config);
  const isSaving = useConfigStore((s) => s.isSaving);
  const error = useConfigStore((s) => s.error);
  const { systemInfo, networkServices, loading: systemLoading, error: systemError } = useSystemInfo();
  const currentStatus = useDnsStore((s) => s.currentStatus);
  const [chromeInstalled, setChromeInstalled] = useState(false);
  const [chromeVersion, setChromeVersion] = useState<string | null>(null);
  const { settings } = config;

  useEffect(() => {
    invoke<boolean>('is_chrome_installed').then(setChromeInstalled).catch(() => {});
    invoke<string | null>('get_chrome_version').then(setChromeVersion).catch(() => {});
  }, []);

  const handleExport = useCallback(async () => {
    const path = await save({
      title: t('settings.export_config'),
      defaultPath: 'dnsswitch-config.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!path) return;
    setIsExporting(true);
    try {
      await invoke('export_config', { filePath: path });
      useToastStore.getState().addToast('success', t('settings.export_success'));
    } catch (e) {
      useToastStore.getState().addToast('error', `${t('settings.export_failed')}: ${e}`);
    } finally {
      setIsExporting(false);
    }
  }, [t]);

  const handleImport = useCallback(async () => {
    const path = await open({
      title: t('settings.import_config'),
      filters: [{ name: 'JSON', extensions: ['json'] }],
      multiple: false,
      directory: false,
    });
    if (!path) return;
    setIsImporting(true);
    try {
      const cfg = await invoke('import_config', { filePath: path });
      useConfigStore.getState().setConfig(cfg as AppConfig);
      useToastStore.getState().addToast('success', t('settings.import_success'));
    } catch (e) {
      useToastStore.getState().addToast('error', `${t('settings.import_failed')}: ${e}`);
    } finally {
      setIsImporting(false);
    }
  }, [t]);

  const handleLanguageChange = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
  }, [i18n]);

  const tabHeader = useMemo(
    () => (
      <div className="flex gap-px bg-border rounded-md p-0.5 self-start">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              className={`px-3.5 py-1 text-[13px] font-medium rounded-[4px] transition-all duration-150 ${
                isActive
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>
    ),
    [activeTab, t],
  );

  const generalTab = useMemo(
    () => (
      <div className="flex flex-col gap-4">
        <section>
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] mb-2 px-0.5">
            {t('settings.general')}
          </h3>
          <SettingsGroup>
            <label className="flex items-center justify-between px-4 py-2 cursor-pointer select-none hover:bg-bg-card transition-colors duration-150">
              <span className="text-sm">{t('settings.auto_start')}</span>
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent rounded shrink-0"
                checked={settings.autoStart}
                onChange={async (e) => {
                  useConfigStore.getState().updateSettings({ autoStart: e.target.checked });
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
            </label>

            <label className="flex items-center justify-between px-4 py-2 cursor-pointer select-none hover:bg-bg-card transition-colors duration-150">
              <span className="text-sm">{t('settings.minimize_to_tray')}</span>
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent rounded shrink-0"
                checked={settings.minimizeToTray}
                onChange={(e) => useConfigStore.getState().updateSettings({ minimizeToTray: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between px-4 py-2 cursor-pointer select-none hover:bg-bg-card transition-colors duration-150">
              <span className="text-sm">{t('settings.notify_on_switch')}</span>
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent rounded shrink-0"
                checked={settings.notifyOnSwitch}
                onChange={(e) => useConfigStore.getState().updateSettings({ notifyOnSwitch: e.target.checked })}
              />
            </label>

            <label className="flex items-center justify-between px-4 py-2 cursor-pointer select-none hover:bg-bg-card transition-colors duration-150">
              <span className="text-sm">{t('settings.check_updates')}</span>
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent rounded shrink-0"
                checked={settings.checkUpdates}
                onChange={(e) => useConfigStore.getState().updateSettings({ checkUpdates: e.target.checked })}
              />
            </label>
          </SettingsGroup>
        </section>

        <section className="mt-4">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] mb-2 px-0.5">
            {t('settings.performance')}
          </h3>
          <SettingsGroup>
            <label className="flex items-center justify-between px-4 py-2 cursor-pointer select-none hover:bg-bg-card transition-colors duration-150">
              <span className="text-sm">{t('settings.latency_interval')}</span>
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  className="px-2 py-1 border border-border/50 rounded bg-bg-card text-text-primary text-sm w-14 text-center focus:outline-none focus:ring-2 focus:ring-accent"
                  value={Math.round(settings.latencyCheckInterval / 1000)}
                  min={LATENCY_CHECK_INTERVAL_MIN_S}
                  max={LATENCY_CHECK_INTERVAL_MAX_S}
                  onChange={(e) => {
                    const val = Math.max(
                      LATENCY_CHECK_INTERVAL_MIN_S,
                      Math.min(LATENCY_CHECK_INTERVAL_MAX_S, Number(e.target.value) || LATENCY_CHECK_INTERVAL_MIN_S),
                    );
                    useConfigStore.getState().updateSettings({ latencyCheckInterval: val * 1000 });
                  }}
                />
                <span className="text-xs text-text-muted">s</span>
              </span>
            </label>
          </SettingsGroup>
        </section>

        <section className="mt-4">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] mb-2 px-0.5">
            {t('settings.appearance')}
          </h3>
          <SettingsGroup>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm">{t('settings.language')}</span>
              <div className="flex gap-2">
                {LANGUAGES.map((lng) => {
                  const selected = i18n.language.startsWith(lng.value);
                  return (
                    <label
                      key={lng.value}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm cursor-pointer select-none transition-colors duration-150 ${
                        selected
                          ? 'bg-accent text-white'
                          : 'bg-bg-card text-text-secondary border border-border/50 hover:border-accent hover:text-text-primary'
                      }`}
                    >
                      <input
                        type="radio"
                        name="language"
                        className="sr-only"
                        checked={selected}
                        onChange={() => handleLanguageChange(lng.value)}
                      />
                      {lng.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-2 border-t border-border/50">
              <span className="text-sm">{t('settings.theme_mode')}</span>
              <div className="flex gap-2">
                {THEME_OPTIONS.map((opt) => {
                  const selected = config.theme.mode === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm cursor-pointer select-none transition-colors duration-150 ${
                        selected
                          ? 'bg-accent text-white'
                          : 'bg-bg-card text-text-secondary border border-border/50 hover:border-accent hover:text-text-primary'
                      }`}
                    >
                      <input
                        type="radio"
                        name="theme"
                        className="sr-only"
                        checked={selected}
                        onChange={() =>
                          useConfigStore.getState().updateTheme(opt.value as (typeof ThemeMode)[keyof typeof ThemeMode])
                        }
                      />
                      {t(opt.key)}
                    </label>
                  );
                })}
              </div>
            </div>
          </SettingsGroup>
        </section>

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <Button variant={ButtonVariant.PRIMARY} onClick={onSave} isLoading={isSaving}>
            {t('settings.save')}
          </Button>
        </div>
      </div>
    ),
    [settings, error, isSaving, onSave, t, config.theme.mode, i18n.language, handleLanguageChange],
  );

  const systemTab = useMemo(
    () => (
      <div className="flex flex-col gap-4">
        {systemLoading ? (
          <div className="flex items-center justify-center py-10">
            <LoadingSpinner size={20} />
          </div>
        ) : (
          <>
            {systemError && (
              <div className="px-3.5 py-2 bg-danger-bg text-danger border border-danger/20 rounded-lg text-xs">
                {systemError}
              </div>
            )}

            {currentStatus && (
              <section>
                <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] mb-2 px-0.5">
                  {t('settings.current_dns')}
                </h3>
                <SettingsGroup>
                  <InfoRow label={t('settings.network_service')} value={currentStatus.networkService} />
                  <InfoRow label={t('settings.dns_servers')} value={currentStatus.currentServers.join(', ')} />
                  <InfoRow label={t('settings.dns_status')} value={currentStatus.isCustom ? t('common.custom') : t('settings.system_default')} />
                  {currentStatus.latency !== undefined && (
                    <InfoRow label={t('settings.latency_interval')} value={t('status.latency_ms', { latency: Math.round(currentStatus.latency) })} />
                  )}
                </SettingsGroup>
              </section>
            )}

            <section className={currentStatus ? 'mt-4' : ''}>
              <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] mb-2 px-0.5">
                {t('settings.chrome')}
              </h3>
              <SettingsGroup>
                <InfoRow label={t('settings.dns_status')} value={chromeInstalled ? t('settings.chrome_installed') : t('settings.chrome_not_installed')} />
                {chromeInstalled && chromeVersion && (
                  <InfoRow label={t('settings.chrome_version')} value={chromeVersion} />
                )}
                <InfoRow label={t('settings.chrome_doh')} value={currentStatus?.chromeDohUrl ? t('common.enabled') : t('common.disabled')} />
                {currentStatus?.chromeDohUrl && (
                  <InfoRow label={t('settings.chrome_doh_url')} value={currentStatus.chromeDohUrl} />
                )}
              </SettingsGroup>
            </section>

            {systemInfo && (
              <section className="mt-4">
                <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] mb-2 px-0.5">
                  {t('settings.system_info')}
                </h3>
                <SettingsGroup>
                  <InfoRow label={t('settings.os')} value={systemInfo.os} />
                  <InfoRow label={t('settings.os_version')} value={systemInfo.osVersion} />
                  <InfoRow label={t('settings.hostname')} value={systemInfo.hostname} />
                  <InfoRow label={t('settings.kernel')} value={systemInfo.kernelVersion} />
                </SettingsGroup>
              </section>
            )}

            <section className={systemInfo ? 'mt-4' : ''}>
              <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] mb-2 px-0.5">
                {t('settings.network_services')}
              </h3>
              {networkServices.length > 0 ? (
                <SettingsGroup>
                  {networkServices.map((svc) => (
                    <div
                      key={svc.name}
                      className="flex items-center justify-between px-4 py-2 cursor-default hover:bg-bg-card transition-colors duration-150"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${svc.isActive ? 'bg-success' : 'bg-text-muted'}`} />
                        <span className="text-xs text-text-primary">{svc.displayName}</span>
                      </div>
                      {svc.dnsServers.length > 0 && (
                        <span className="text-xs text-text-muted shrink-0">{svc.dnsServers.join(', ')}</span>
                      )}
                    </div>
                  ))}
                </SettingsGroup>
              ) : (
                !systemLoading && (
                  <p className="text-xs text-text-muted px-4 py-5 text-center bg-bg-secondary rounded-lg">
                    {t('settings.network_services_empty')}
                  </p>
                )
              )}
            </section>
          </>
        )}
      </div>
    ),
    [systemLoading, systemInfo, networkServices, systemError, currentStatus, chromeInstalled, chromeVersion, t],
  );

  const toolsTab = useMemo(
    () => (
      <div className="flex flex-col gap-4">
        <section>
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.05em] mb-2 px-0.5">
            {t('settings.tools')}
          </h3>
          <SettingsGroup>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm">{t('settings.tools_desc')}</span>
              <div className="flex items-center gap-2">
                <Button variant={ButtonVariant.SECONDARY} onClick={handleExport} isLoading={isExporting}>
                  {isExporting ? t('common.exporting') : t('settings.export')}
                </Button>
                <Button variant={ButtonVariant.SECONDARY} onClick={handleImport} isLoading={isImporting}>
                  {isImporting ? t('common.importing') : t('settings.import')}
                </Button>
              </div>
            </div>
          </SettingsGroup>
        </section>
      </div>
    ),
    [handleExport, handleImport, isExporting, isImporting, t],
  );

  const tabContent: Record<TabKey, React.ReactNode> = useMemo(
    () => ({
      general: generalTab,
      system: systemTab,
      tools: toolsTab,
    }),
    [generalTab, systemTab, toolsTab],
  );

  return (
    <div className="flex flex-col gap-4">
      {tabHeader}
      {tabContent[activeTab]}
    </div>
  );
}
