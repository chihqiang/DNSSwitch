import { useTranslation } from 'react-i18next';
import { useDnsStatus, useDnsServers } from '@/hooks';
import { Badge, BadgeVariant } from '@/components/common';
import { getLatencyBadgeVariant } from '@/constants';
import { useDnsStore } from '@/stores';

export function StatusBar() {
  const { t } = useTranslation();
  const { currentStatus, lastLeakResult } = useDnsStatus();
  const { servers } = useDnsServers();
  const healthStatus = useDnsStore((s) => s.healthStatus);

  const activeServer = servers.find((s) => s.isActive);
  const latency = activeServer?.latency;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-t border-border text-xs text-text-muted gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            healthStatus === null ? 'bg-text-muted' : healthStatus.healthy ? 'bg-success' : 'bg-danger'
          }`}
        />
        <span className="text-text-primary text-xs truncate">
          {activeServer
            ? `${activeServer.name} (${activeServer.addresses[0]})`
            : currentStatus
              ? `${currentStatus.networkService}: ${currentStatus.currentServers.join(', ')}`
              : t('common.loading')}
        </span>
        {healthStatus && !healthStatus.healthy && healthStatus.error && (
          <span className="text-danger truncate ml-2">{healthStatus.error}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {healthStatus && (
          <Badge variant={healthStatus.healthy ? BadgeVariant.SUCCESS : BadgeVariant.DANGER}>
            {healthStatus.healthy ? t('status.healthy') : t('status.unhealthy')}
          </Badge>
        )}
        {latency !== undefined && (
          <Badge variant={getLatencyBadgeVariant(latency)}>
            {t('status.latency_ms', { latency: Math.round(latency) })}
          </Badge>
        )}
        {currentStatus?.isCustom && <Badge variant={BadgeVariant.INFO}>{t('status.custom_dns')}</Badge>}
        {lastLeakResult?.leakDetected && <Badge variant={BadgeVariant.DANGER}>{t('status.leak_detected')}</Badge>}
        {healthStatus?.leakDetected && <Badge variant={BadgeVariant.DANGER}>{t('status.leak_detected')}</Badge>}
      </div>
    </div>
  );
}
