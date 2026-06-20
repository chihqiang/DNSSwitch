import { useTranslation } from 'react-i18next';
import { useDnsStatus, useDnsServers } from '@/hooks';
import { Card, Badge, Button, ButtonVariant } from '@/components/common';
import { getLatencyBadgeVariant } from '@/constants';

export function DnsSwitcher() {
  const { t } = useTranslation();
  const { currentStatus, isSwitching, switchDns, resetToSystem } = useDnsStatus();
  const { servers } = useDnsServers();

  return (
    <Card className="flex flex-col gap-3 p-3">
      <h2 className="text-sm font-semibold">{t('status.quick_switch')}</h2>

      <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary rounded text-sm">
        <span className="text-text-muted shrink-0">{t('status.current_dns')}</span>
        <code className="bg-transparent p-0 text-text-primary !text-sm font-medium">
          {currentStatus?.currentServers.join(', ') || t('common.unknown')}
        </code>
      </div>

      <div className="flex flex-col gap-1">
        {servers
          .filter((s) => !s.isSystem)
          .map((server) => (
            <div
              key={server.id}
              className={`flex items-center justify-between px-3 py-2 rounded transition-colors duration-150 hover:bg-bg-secondary ${server.isActive ? 'bg-accent-light' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-sm truncate ${server.isActive ? 'font-semibold' : 'font-medium'}`}>
                  {server.name}
                </span>
                {server.latency !== undefined && (
                  <Badge variant={getLatencyBadgeVariant(server.latency)}>
                    {t('status.latency_ms', {
                      latency: Math.round(server.latency),
                    })}
                  </Badge>
                )}
              </div>
              <Button
                variant={server.isActive ? ButtonVariant.SECONDARY : ButtonVariant.PRIMARY}
                size="sm"
                onClick={() => switchDns(server.id)}
                disabled={server.isActive || isSwitching}
                isLoading={isSwitching}
              >
                {server.isActive ? t('common.active') : t('common.switch')}
              </Button>
            </div>
          ))}
      </div>

      <div className="pt-2 border-t border-border">
        <Button
          variant={ButtonVariant.GHOST}
          size="sm"
          onClick={resetToSystem}
          disabled={isSwitching}
          isLoading={isSwitching}
        >
          {t('server.reset_to_system')}
        </Button>
      </div>
    </Card>
  );
}
