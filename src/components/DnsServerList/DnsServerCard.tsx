import { useTranslation } from 'react-i18next';
import { memo, useState, useRef, useEffect } from 'react';
import type { DnsServer } from '@/types';
import { Badge, Button, ButtonVariant, BadgeVariant } from '@/components/common';
import { getLatencyBadgeVariant } from '@/constants';

interface DnsServerCardProps {
  server: DnsServer;
  onSwitch: (id: string) => void;
  onSwitchChromeDoh: (id: string) => void;
  onTest: (id: string) => void;
  onEdit: (server: DnsServer) => void;
  onDelete: (id: string, name: string) => void;
  isSwitching: boolean;
  switchingServerId: string | null;
  chromeSwitchingServerId: string | null;
  chromeDohActive?: boolean;
  chromeInstalled?: boolean;
}

export const DnsServerCard = memo(function DnsServerCard({
  server,
  onSwitch,
  onSwitchChromeDoh,
  onTest,
  onEdit,
  onDelete,
  isSwitching,
  switchingServerId,
  chromeSwitchingServerId,
  chromeDohActive,
  chromeInstalled,
}: DnsServerCardProps) {
  const { t } = useTranslation();
  const latency = server.latency;
  const isThisSwitching = isSwitching && switchingServerId === server.id;
  const isThisChromeSwitching = chromeSwitchingServerId === server.id;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 transition-colors duration-150 ${
        server.isActive ? 'bg-accent-light/20' : 'hover:bg-bg-card'
      }`}
    >
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${server.isActive ? 'bg-accent' : 'bg-text-muted/40'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">{server.name}</span>
          <span className="text-xs text-text-muted/70 truncate">{t('dns_provider.' + server.provider.name)}</span>
          {server.isActive && (
            <span className="text-[10px] font-medium text-accent uppercase tracking-wider">{t('common.active')}</span>
          )}
          {chromeDohActive && (
            <span className="text-[10px] font-medium text-success uppercase tracking-wider">
              {t('common.chrome_doh')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {server.addresses.map((addr) => (
            <code key={addr} className="text-xs text-text-secondary">
              {addr}
            </code>
          ))}
          {latency !== undefined && (
            <Badge variant={getLatencyBadgeVariant(latency)}>
              {t('status.latency_ms', { latency: Math.round(latency) })}
            </Badge>
          )}
          {server.tags.map((tag) => (
            <Badge key={tag} variant={BadgeVariant.INFO}>
              {t('tag.' + tag)}
            </Badge>
          ))}
          {server.dohUrl && <Badge variant={BadgeVariant.INFO}>DoH</Badge>}
          {server.dotAddress && <Badge variant={BadgeVariant.INFO}>DoT</Badge>}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-150">
        {server.addresses.length > 0 && (
          <Button
            variant={server.isActive ? ButtonVariant.SECONDARY : ButtonVariant.PRIMARY}
            size="sm"
            onClick={() => onSwitch(server.id)}
            disabled={isSwitching}
            isLoading={isThisSwitching}
          >
            {server.isActive ? t('common.active_dns') : 'DNS'}
          </Button>
        )}
        {server.dohUrl && chromeInstalled && (
          <Button
            variant={chromeDohActive ? ButtonVariant.GHOST : ButtonVariant.SECONDARY}
            size="sm"
            disabled={isThisChromeSwitching}
            isLoading={isThisChromeSwitching}
            className={
              chromeDohActive
                ? 'bg-accent-light/20 text-accent font-medium border-accent/30 hover:bg-accent-light/30'
                : ''
            }
            onClick={() => onSwitchChromeDoh(server.id)}
          >
            {isThisChromeSwitching ? t('common.switching') : chromeDohActive ? t('common.chrome_doh_active') : 'Chrome'}
          </Button>
        )}
        {!server.isActive && server.addresses.length === 0 && !server.dohUrl && (
          <span className="text-xs text-text-muted self-center mr-1">{t('server.no_ip_hint')}</span>
        )}

        <div className="relative" ref={menuRef}>
          <Button variant={ButtonVariant.GHOST} size="sm" onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </Button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 min-w-[120px] bg-bg-card border border-border rounded-md shadow-lg py-1 z-10 animate-fadeIn">
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-border/30 transition-colors"
                onClick={() => {
                  onTest(server.id);
                  setMenuOpen(false);
                }}
              >
                {t('common.test')}
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-border/30 transition-colors"
                onClick={() => {
                  onEdit(server);
                  setMenuOpen(false);
                }}
              >
                {t('common.edit')}
              </button>
              {!server.isSystem && (
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-danger-bg transition-colors"
                  onClick={() => {
                    onDelete(server.id, server.name);
                    setMenuOpen(false);
                  }}
                >
                  {t('common.delete')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
