// ============================================================
// DnsServerList DNS 服务器列表组件
// 渲染所有 DNS 服务器的卡片网格，处理切换/测试/编辑/删除操作
// ============================================================

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDnsStatus, useDnsServers } from '@/hooks';
import { DnsServerCard } from './DnsServerCard';
import { Button, ButtonVariant, EmptyState, LoadingSpinner, ConfirmDialog } from '@/components/common';
import { useConfigStore } from '@/stores';
import type { DnsServer } from '@/types';

interface DnsServerListProps {
  onEdit: (server: DnsServer) => void;
  onAdd: () => void;
  onDelete: (id: string, name: string) => void;
}

export function DnsServerList({ onEdit, onAdd, onDelete }: DnsServerListProps) {
  const { t } = useTranslation();
  const { isSwitching, isTesting, switchingServerId, testingServerId, switchDns, testLatency } = useDnsStatus();
  const { servers, refreshLatency, resetToSystem } = useDnsServers();
  const configLoaded = useConfigStore((s) => s.isLoaded);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSwitch = useCallback(
    async (id: string) => {
      await switchDns(id);
    },
    [switchDns],
  );
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
          {servers.map((server) => (
            <DnsServerCard
              key={server.id}
              server={server}
              onSwitch={handleSwitch}
              onTest={handleTest}
              onEdit={onEdit}
              onDelete={onDelete}
              isSwitching={isSwitching}
              isTesting={isTesting}
              switchingServerId={switchingServerId}
              testingServerId={testingServerId}
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
    </div>
  );
}
