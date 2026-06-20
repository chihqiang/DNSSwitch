// ============================================================
// DnsServerList DNS 服务器列表组件
// 渲染所有 DNS 服务器的卡片网格，处理切换/测试/编辑/删除操作
// ============================================================

import { useTranslation } from 'react-i18next';
import { useDnsStatus, useDnsServers } from '@/hooks';
import { DnsServerCard } from './DnsServerCard';
import { Button, ButtonVariant, EmptyState } from '@/components/common';
import type { DnsServer } from '@/types';

interface DnsServerListProps {
  onEdit: (server: DnsServer) => void;
  onAdd: () => void;
  onDelete: (id: string, name: string) => void;
}

export function DnsServerList({ onEdit, onAdd, onDelete }: DnsServerListProps) {
  const { t } = useTranslation();
  const { isSwitching, isTesting, switchingServerId, testingServerId, switchDns, testLatency } = useDnsStatus();
  const { servers, refreshLatency } = useDnsServers();

  async function handleSwitch(id: string) {
    await switchDns(id);
  }

  async function handleTest(id: string) {
    await testLatency(id);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('server.title')}</h2>
        <div className="flex gap-2">
          {servers.length > 0 && (
            <Button variant={ButtonVariant.GHOST} size="sm" onClick={refreshLatency}>
              {t('server.refresh_latency')}
            </Button>
          )}
          <Button variant={ButtonVariant.PRIMARY} size="sm" onClick={onAdd}>
            {t('server.add_server')}
          </Button>
        </div>
      </div>

      {servers.length === 0 && (
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

      {/* 响应式网格：自动填充，每列最小 280px */}
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
    </div>
  );
}
