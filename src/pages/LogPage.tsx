import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  BadgeVariant,
  Button,
  ButtonVariant,
  ConfirmDialog,
  LoadingSpinner,
  ErrorBoundary,
} from '@/components/common';
import { useRequestLogStore } from '@/stores';

const DEFAULT_LIMIT = 20;
const LOAD_MORE_STEP = 50;

interface LogLine {
  timestamp: string;
  level: string;
  tag: string;
  message: string;
  raw: string;
}

export function LogPage() {
  const { t } = useTranslation();
  const requestEntries = useRequestLogStore((s) => s.entries);
  const [logLines, setLogLines] = useState<LogLine[]>([]);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showClearTodayConfirm, setShowClearTodayConfirm] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef(0);
  const restoreScrollRef = useRef(false);

  const loadLog = useCallback(async (count: number) => {
    if (scrollRef.current) {
      savedScrollRef.current = scrollRef.current.scrollTop;
      restoreScrollRef.current = true;
    }
    try {
      const data = await invoke<LogLine[]>('read_log_file', { limit: count });
      setLogLines((prev) => {
        if (prev.length === data.length && prev.every((l, i) => l.raw === data[i].raw)) {
          return prev;
        }
        return data;
      });
      setLoadError(null);
    } catch (e) {
      setLoadError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useLayoutEffect(() => {
    if (restoreScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = savedScrollRef.current;
      restoreScrollRef.current = false;
    }
  });

  useEffect(() => {
    loadLog(limit);
    const interval = setInterval(() => loadLog(limit), 5000);
    return () => clearInterval(interval);
  }, [limit, loadLog]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          setLimit((prev) => prev + LOAD_MORE_STEP);
        }
      },
      { rootMargin: '100px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoading]);

  const levelBadgeVariant = (level: string): BadgeVariant => {
    switch (level) {
      case 'ERROR':
        return BadgeVariant.DANGER;
      case 'WARN':
        return BadgeVariant.WARNING;
      case 'INFO':
        return BadgeVariant.SUCCESS;
      default:
        return BadgeVariant.INFO;
    }
  };

  const isEmpty = logLines.length === 0 && requestEntries.length === 0 && !isLoading;

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('log.title')}</h2>
          <div className="flex gap-2">
            <Button variant={ButtonVariant.GHOST} size="sm" onClick={() => setShowClearTodayConfirm(true)}>
              {t('log.clear')}
            </Button>
            <Button variant={ButtonVariant.GHOST} size="sm" onClick={() => setShowClearAllConfirm(true)}>
              {t('log.clear_all')}
            </Button>
          </div>
        </div>

        {isEmpty && <p className="text-sm text-text-muted text-center py-10">{t('log.empty')}</p>}

        {isLoading && requestEntries.length === 0 && logLines.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size={18} />
          </div>
        )}

        {loadError && (
          <div className="px-3.5 py-2 bg-danger-bg text-danger border border-danger/20 rounded-lg text-xs">
            {loadError}
          </div>
        )}

        {requestEntries.length > 0 && (
          <div className="flex flex-col bg-bg-secondary rounded-lg overflow-hidden">
            {requestEntries.slice(0, 50).map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-bg-card transition-colors text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={entry.success ? BadgeVariant.SUCCESS : BadgeVariant.DANGER}>
                      {entry.success ? t('log.ok') : t('log.failed')}
                    </Badge>
                    <span className="font-medium text-text-primary truncate">{entry.domain}</span>
                    <span className="text-text-muted shrink-0">{entry.recordType}</span>
                  </div>
                  <span className="text-text-muted/60 shrink-0">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-text-muted/70 mt-1">
                  <span className="text-text-muted/50">{entry.protocol.toUpperCase()}</span>
                  <span className="text-text-muted/50" aria-hidden="true">→</span>
                  <span className="truncate">{entry.server}</span>
                  {entry.latencyMs > 0 && (
                    <span>{t('status.latency_ms', { latency: Math.round(entry.latencyMs) })}</span>
                  )}
                </div>
                {entry.detail && <div className="text-danger mt-1">{entry.detail}</div>}
                {entry.answers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {entry.answers.map((ans: string) => (
                      <code key={ans} className="text-[11px] bg-bg-card px-1.5 py-0.5 rounded">
                        {ans}
                      </code>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {logLines.length > 0 && (
          <div className="flex flex-col bg-bg-secondary rounded-lg overflow-hidden">
            <div ref={scrollRef} className="max-h-[500px] overflow-y-auto">
              {logLines.map((line, i) => (
                <div
                  key={i}
                  className="px-3 py-1.5 font-mono text-[11px] leading-relaxed border-b border-border/20 hover:bg-bg-card transition-colors flex items-start gap-2"
                >
                  <Badge variant={levelBadgeVariant(line.level)}>
                    {line.level}
                  </Badge>
                  <span className="text-text-muted/50 shrink-0">{line.timestamp}</span>
                  {line.tag && (
                    <span className="text-text-muted/70 shrink-0">[{line.tag}]</span>
                  )}
                  <span className="text-text-primary break-all">{line.message}</span>
                </div>
              ))}
              <div ref={sentinelRef} className="h-4" />
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={showClearTodayConfirm}
          onClose={() => setShowClearTodayConfirm(false)}
          title={t('common.confirm_clear_log')}
          message={t('log.clear_today_desc')}
          confirmLabel={t('log.clear')}
          onConfirm={async () => {
            setShowClearTodayConfirm(false);
            await invoke('clear_log_file');
            setLogLines([]);
            setLimit(DEFAULT_LIMIT);
          }}
          variant="danger"
        />

        <ConfirmDialog
          isOpen={showClearAllConfirm}
          onClose={() => setShowClearAllConfirm(false)}
          title={t('common.confirm_clear_log')}
          message={t('log.clear_all_desc')}
          confirmLabel={t('log.clear_all')}
          onConfirm={async () => {
            setShowClearAllConfirm(false);
            await invoke('clear_all_logs');
            setLogLines([]);
            setLimit(DEFAULT_LIMIT);
          }}
          variant="danger"
        />
      </div>
    </ErrorBoundary>
  );
}
