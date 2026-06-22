import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDnsStatus, useDnsServers } from '@/hooks';
import { invoke } from '@tauri-apps/api/core';
import { DnsServerCard } from './DnsServerCard';
import { Button, ButtonVariant, EmptyState, LoadingSpinner, ConfirmDialog } from '@/components/common';
import { useConfigStore } from '@/stores';
import { useToastStore } from '@/stores/toastStore';
import type { DnsServer } from '@/types';

interface DnsServerListProps {
  onEdit: (server: DnsServer) => void;
  onAdd: () => void;
  onDelete: (id: string, name: string) => void;
}

export function DnsServerList({ onEdit, onAdd, onDelete }: DnsServerListProps) {
  const { t } = useTranslation();
  const {
    currentStatus,
    isSwitching,
    switchingServerId,
    switchDns,
    switchChromeDoh,
    testLatency,
    fetchStatus,
    chromeSwitchingServerId,
  } = useDnsStatus();
  const { servers, refreshLatency, resetToSystem } = useDnsServers();
  const configLoaded = useConfigStore((s) => s.isLoaded);
  const activeChromeServerId = useConfigStore((s) => s.config.activeChromeServerId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showChromeResetConfirm, setShowChromeResetConfirm] = useState(false);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [pendingChromeSwitchId, setPendingChromeSwitchId] = useState<string | null>(null);

  const handleSwitchRequest = useCallback((id: string) => {
    setPendingSwitchId(id);
  }, []);

  const handleChromeSwitchRequest = useCallback((id: string) => {
    setPendingChromeSwitchId(id);
  }, []);

  const handleConfirmSwitch = useCallback(async () => {
    const id = pendingSwitchId;
    setPendingSwitchId(null);
    if (id) await switchDns(id);
  }, [pendingSwitchId, switchDns]);

  const handleConfirmChromeSwitch = useCallback(async () => {
    const id = pendingChromeSwitchId;
    setPendingChromeSwitchId(null);
    if (id) await switchChromeDoh(id);
  }, [pendingChromeSwitchId, switchChromeDoh]);

  const handleTest = useCallback(
    async (id: string) => {
      await testLatency(id);
    },
    [testLatency],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshLatency();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshLatency]);

  const handleResetConfirm = useCallback(async () => {
    try {
      await resetToSystem();
    } finally {
      setShowResetConfirm(false);
    }
  }, [resetToSystem]);

  const handleChromeReset = useCallback(async () => {
    try {
      await invoke('reset_chrome_doh');
      const { config: currentConfig } = useConfigStore.getState();
      useConfigStore.getState().setConfig({ ...currentConfig, activeChromeServerId: undefined });
      await fetchStatus();
      useToastStore.getState().addToast('success', t('status.chrome_reset'));
    } catch (e) {
      useToastStore.getState().addToast('error', String(e));
    } finally {
      setShowChromeResetConfirm(false);
    }
  }, [t, fetchStatus]);

  const pendingServer = pendingSwitchId ? servers.find((s) => s.id === pendingSwitchId) : null;

  const pendingChromeServer = pendingChromeSwitchId ? servers.find((s) => s.id === pendingChromeSwitchId) : null;

  const chromeDohActive = !!activeChromeServerId;
  const chromeInstalled = currentStatus?.chromeInstalled ?? false;
  const isLoading = !configLoaded;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('server.title')}</h2>
        <div className="flex gap-2">
          {servers.length > 0 && (
            <>
              <Button variant={ButtonVariant.GHOST} size="sm" onClick={() => setShowResetConfirm(true)}>
                {t('server.reset_system')}
              </Button>
              {chromeDohActive && chromeInstalled && (
                <Button variant={ButtonVariant.GHOST} size="sm" onClick={() => setShowChromeResetConfirm(true)}>
                  {t('server.reset_chrome')}
                </Button>
              )}
              <Button variant={ButtonVariant.GHOST} size="sm" onClick={handleRefresh} isLoading={isRefreshing}>
                {t('server.refresh_latency')}
              </Button>
            </>
          )}
          <Button variant={ButtonVariant.PRIMARY} size="sm" onClick={onAdd}>
            {t('server.add_server')}
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size={20} />
          <span className="ml-2 text-sm text-text-muted">{t('common.servers_loading')}</span>
        </div>
      )}

      {!isLoading && servers.length === 0 && (
        <EmptyState
          title={t('server.empty_title')}
          description={t('server.empty_desc')}
          action={
            <Button variant={ButtonVariant.PRIMARY} size="sm" onClick={onAdd}>
              {t('server.add_server')}
            </Button>
          }
        />
      )}

      {servers.length > 0 && (
        <div className="flex flex-col bg-bg-secondary rounded-lg overflow-hidden">
          {servers.map((server) => (
            <DnsServerCard
              key={server.id}
              server={server}
              onSwitch={handleSwitchRequest}
              onSwitchChromeDoh={handleChromeSwitchRequest}
              onTest={handleTest}
              onEdit={onEdit}
              onDelete={onDelete}
              isSwitching={isSwitching}
              switchingServerId={switchingServerId}
              chromeSwitchingServerId={chromeSwitchingServerId}
              chromeDohActive={!!server.dohUrl && server.id === activeChromeServerId}
              chromeInstalled={chromeInstalled}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title={t('common.confirm_reset_dns')}
        message={t('common.confirm_reset_dns_desc')}
        confirmLabel={t('server.reset_system')}
        onConfirm={handleResetConfirm}
        variant={ButtonVariant.SECONDARY}
      />

      <ConfirmDialog
        isOpen={showChromeResetConfirm}
        onClose={() => setShowChromeResetConfirm(false)}
        title={t('common.confirm_reset_chrome')}
        message={t('common.confirm_reset_chrome_desc')}
        confirmLabel={t('server.reset_chrome')}
        onConfirm={handleChromeReset}
        variant={ButtonVariant.SECONDARY}
      />

      <ConfirmDialog
        isOpen={pendingSwitchId !== null}
        onClose={() => setPendingSwitchId(null)}
        title={t('common.confirm_switch_dns')}
        message={pendingServer ? t('common.confirm_switch_dns_desc', { name: pendingServer.name }) : ''}
        confirmLabel={t('common.switch')}
        onConfirm={handleConfirmSwitch}
        variant={ButtonVariant.PRIMARY}
      />

      <ConfirmDialog
        isOpen={pendingChromeSwitchId !== null}
        onClose={() => setPendingChromeSwitchId(null)}
        title={t('common.confirm_switch_chrome')}
        message={pendingChromeServer ? t('common.confirm_switch_chrome_desc', { name: pendingChromeServer.name }) : ''}
        confirmLabel={t('common.chrome_doh')}
        onConfirm={handleConfirmChromeSwitch}
        variant={ButtonVariant.PRIMARY}
      />
    </div>
  );
}
