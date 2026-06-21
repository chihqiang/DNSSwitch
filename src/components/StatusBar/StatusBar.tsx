// ============================================================
// StatusBar 底部状态栏组件
// 显示当前 DNS 状态、健康指示灯、延迟、泄露检测结果等
// ============================================================

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDnsStatus, useDnsServers } from '@/hooks';
import { Badge, BadgeVariant } from '@/components/common';
import { getLatencyBadgeVariant } from '@/constants';
import { useDnsStore } from '@/stores';

function StatusBarInner() {
  const { t } = useTranslation();
  const { currentStatus, lastLeakResult } = useDnsStatus();
  const { servers } = useDnsServers();
  const healthStatus = useDnsStore((s) => s.healthStatus);

  const activeServer = servers.find((s) => s.isActive);
  const latency = activeServer?.latency;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-bg-secondary border-t border-border text-xs text-text-muted gap-4">
      {/* 左侧：状态指示灯 + 当前 DNS 信息 */}
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

      {/* 右侧：状态标签 */}
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
        {/* 合并 lastLeakResult 和 healthStatus 的泄露检测（避免重复显示） */}
        {(lastLeakResult?.leakDetected || healthStatus?.leakDetected) && (
          <Badge variant={BadgeVariant.DANGER}>{t('status.leak_detected')}</Badge>
        )}
      </div>
    </div>
  );
}

export const StatusBar = memo(StatusBarInner);
