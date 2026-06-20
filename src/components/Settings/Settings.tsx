import { useTranslation } from 'react-i18next'
import { useConfigStore } from '@/stores'
import { ThemeMode } from '@/types'
import { useSystemInfo } from '@/hooks'
import { Card, Button, ButtonVariant } from '@/components/common'
import {
  LATENCY_CHECK_INTERVAL_MIN_S,
  LATENCY_CHECK_INTERVAL_MAX_S,
} from '@/constants'

interface SettingsProps {
  onSave: () => void
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
]

const THEME_OPTIONS = [
  { value: ThemeMode.SYSTEM, key: 'theme.system' },
  { value: ThemeMode.LIGHT, key: 'theme.light' },
  { value: ThemeMode.DARK, key: 'theme.dark' },
]

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="text-xs text-text-muted w-24 shrink-0">{label}</span>
      <span className="text-xs text-text-primary truncate">{value}</span>
    </div>
  )
}

export function Settings({ onSave }: SettingsProps) {
  const { t, i18n } = useTranslation()
  const { config, updateSettings, updateTheme, isSaving, error } = useConfigStore()
  const { systemInfo, networkServices } = useSystemInfo()
  const { settings } = config

  function handleLanguageChange(lng: string) {
    i18n.changeLanguage(lng)
  }

  return (
    <Card className="flex flex-col gap-4 p-3">
      <h2 className="text-sm font-semibold">{t('settings.title')}</h2>

      <div className="flex flex-col gap-4">
        <section>
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.general')}</h3>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent rounded"
                checked={settings.autoStart}
                onChange={(e) => updateSettings({ autoStart: e.target.checked })}
              />
              <span className="text-sm">{t('settings.auto_start')}</span>
            </label>

            <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent rounded"
                checked={settings.minimizeToTray}
                onChange={(e) =>
                  updateSettings({ minimizeToTray: e.target.checked })
                }
              />
              <span className="text-sm">{t('settings.minimize_to_tray')}</span>
            </label>

            <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent rounded"
                checked={settings.notifyOnSwitch}
                onChange={(e) =>
                  updateSettings({ notifyOnSwitch: e.target.checked })
                }
              />
              <span className="text-sm">{t('settings.notify_on_switch')}</span>
            </label>

            <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent rounded"
                checked={settings.checkUpdates}
                onChange={(e) =>
                  updateSettings({ checkUpdates: e.target.checked })
                }
              />
              <span className="text-sm">{t('settings.check_updates')}</span>
            </label>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.performance')}</h3>
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

        <section>
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.appearance')}</h3>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
              <span className="text-sm">{t('settings.language')}</span>
              <select
                className="ml-auto px-2 py-1 border border-border rounded bg-bg-card text-text-primary text-sm"
                value={i18n.language.startsWith('zh') ? 'zh' : 'en'}
                onChange={(e) => handleLanguageChange(e.target.value)}
              >
                {LANGUAGES.map((lng) => (
                  <option key={lng.value} value={lng.value}>{lng.label}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2.5 px-3 py-2 bg-bg-secondary rounded cursor-pointer select-none hover:bg-border transition-colors duration-150">
              <span className="text-sm">{t('settings.theme_mode')}</span>
              <select
                className="ml-auto px-2 py-1 border border-border rounded bg-bg-card text-text-primary text-sm"
                value={config.theme.mode}
                onChange={(e) => updateTheme(e.target.value as typeof ThemeMode[keyof typeof ThemeMode])}
              >
                {THEME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {systemInfo && (
          <section>
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.system_info')}</h3>
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
            <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">{t('settings.network_services')}</h3>
            <div className="bg-bg-secondary rounded">
              {networkServices.map((svc) => (
                <div key={svc.name} className="flex items-center gap-2 px-3 py-1.5 border-b border-border last:border-b-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${svc.isActive ? 'bg-success' : 'bg-text-muted'}`} />
                  <span className="text-xs text-text-primary">{svc.displayName}</span>
                  {svc.dnsServers.length > 0 && (
                    <span className="text-xs text-text-muted ml-auto">{svc.dnsServers.join(', ')}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="pt-3 border-t border-border">
        <Button variant={ButtonVariant.PRIMARY} onClick={onSave} isLoading={isSaving}>
          {t('settings.save')}
        </Button>
      </div>
    </Card>
  )
}
