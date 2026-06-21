// ============================================================
// LogPage 日志页面
// 统一展示 DNS 查询记录和 DNS 操作历史，合并时间线
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Badge,
  BadgeVariant,
  Button,
  ButtonVariant,
  LoadingSpinner,
  ErrorBoundary,
  ConfirmDialog,
} from '@/components/common';
import { logger } from '@/lib/log';
import { useRequestLogStore } from '@/stores';
import type { DnsEvent } from '@/types';

type TimelineEntry =
  | { kind: 'query'; data: ReturnType<typeof useRequestLogStore.getState>['entries'][number] }
  | { kind: 'event'; data: DnsEvent };

export function LogPage() {
  const { t } = useTranslation();
  const requestEntries = useRequestLogStore((s) => s.entries);
  const [historyEvents, setHistoryEvents] = useState<DnsEvent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setLoadError(null);
    try {
      const data = await invoke<DnsEvent[]>('get_history');
      setHistoryEvents(data);
    } catch (e) {
      setLoadError(String(e));
      setHistoryEvents([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    const onFocus = () => loadHistory();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadHistory]);

  // 合并请求日志和操作历史为统一时间线，按时间倒序
  const timeline: TimelineEntry[] = useMemo(
    () =>
      [
        ...requestEntries.map((e): TimelineEntry => ({ kind: 'query' as const, data: e })),
        ...historyEvents.map((e): TimelineEntry => ({ kind: 'event' as const, data: e })),
      ].sort((a, b) => {
        const ta = a.kind === 'query' ? a.data.timestamp : a.data.timestamp;
        const tb = b.kind === 'query' ? b.data.timestamp : b.data.timestamp;
        return tb - ta;
      }),
    [requestEntries, historyEvents],
  );

  const isEmpty = timeline.length === 0 && !isLoadingHistory;

  const handleClearAll = async () => {
    useRequestLogStore.getState().clearEntries();
    try {
      await invoke('clear_history');
    } catch (e) {
      logger.error(`Failed to clear history: ${e}`);
    }
    setHistoryEvents([]);
  };

  return (
    <ErrorBoundary>
      <Card className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('log.title')}</h2>
          {timeline.length > 0 && (
            <Button variant={ButtonVariant.GHOST} size="sm" onClick={() => setShowClearConfirm(true)}>
              {t('log.clear')}
            </Button>
          )}
        </div>

        {isLoadingHistory && requestEntries.length === 0 && (
          <div className="flex items-center justify-center py-6">
            <LoadingSpinner size={18} />
          </div>
        )}

        {loadError && (
          <div className="px-3 py-2 bg-danger-bg text-danger border border-danger/20 rounded text-xs">{loadError}</div>
        )}

        {isEmpty && <p className="text-sm text-text-muted text-center py-8">{t('log.empty')}</p>}

        {timeline.length > 0 && (
          <div className="flex flex-col gap-1 max-h-[600px] overflow-y-auto">
            {timeline.map((entry) =>
              entry.kind === 'query' ? (
                // DNS 查询日志条目
                <div key={entry.data.id} className="flex flex-col gap-1 px-2.5 py-2 bg-bg-secondary rounded text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.data.success ? BadgeVariant.SUCCESS : BadgeVariant.DANGER}>
                        {entry.data.success ? 'OK' : 'FAIL'}
                      </Badge>
                      <span className="font-medium">{entry.data.domain}</span>
                      <span className="text-text-muted">{entry.data.recordType}</span>
                      <span className="text-text-muted text-[10px] uppercase bg-bg-card px-1 py-px rounded">
                        {entry.data.type}
                      </span>
                    </div>
                    <span className="text-text-muted">{new Date(entry.data.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-muted">
                    <span>
                      {entry.data.protocol.toUpperCase()} → {entry.data.server}
                    </span>
                    <span>{Math.round(entry.data.latencyMs)}ms</span>
                  </div>
                  {entry.data.detail && <span className="text-danger">{entry.data.detail}</span>}
                  {entry.data.answers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {entry.data.answers.map((ans: string) => (
                        <code key={ans} className="text-xs bg-bg-card px-1.5 py-0.5 rounded">
                          {ans}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // DNS 操作历史条目
                <div key={entry.data.id} className="flex flex-col gap-1 px-2.5 py-2 bg-bg-secondary rounded text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.data.success ? BadgeVariant.SUCCESS : BadgeVariant.DANGER}>
                        {entry.data.success ? t('log.ok') : t('log.failed')}
                      </Badge>
                      <span className="font-medium">{entry.data.serverName}</span>
                      <span className="text-text-muted text-[10px] uppercase bg-bg-card px-1 py-px rounded">
                        {entry.data.eventType}
                      </span>
                    </div>
                    <span className="text-text-muted">{new Date(entry.data.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-muted">
                    {entry.data.latencyMs !== undefined && <span>{Math.round(entry.data.latencyMs)}ms</span>}
                    <span>{entry.data.addresses.join(', ')}</span>
                  </div>
                  {entry.data.detail && <span className="text-text-muted">{entry.data.detail}</span>}
                </div>
              ),
            )}
          </div>
        )}

        <ConfirmDialog
          isOpen={showClearConfirm}
          onClose={() => setShowClearConfirm(false)}
          title={t('common.confirm_clear_log')}
          message={t('common.confirm_clear_log_desc')}
          confirmLabel={t('log.clear')}
          onConfirm={() => {
            setShowClearConfirm(false);
            handleClearAll();
          }}
          variant="danger"
        />
      </Card>
    </ErrorBoundary>
  );
}
