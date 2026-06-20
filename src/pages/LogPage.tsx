// ============================================================
// LogPage DNS 请求日志页面
// 展示所有 DNS 查询的记录（成功/失败、延迟、结果）
// ============================================================

import { useTranslation } from 'react-i18next';
import { Card, Badge, BadgeVariant, Button, ButtonVariant, ErrorBoundary } from '@/components/common';
import { useRequestLogStore } from '@/stores';

export function LogPage() {
  const { t } = useTranslation();
  const { entries, clearEntries } = useRequestLogStore();

  return (
    <ErrorBoundary>
      <Card className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('log.title')}</h2>
          {entries.length > 0 && (
            <Button variant={ButtonVariant.GHOST} size="sm" onClick={clearEntries}>
              {t('log.clear')}
            </Button>
          )}
        </div>

        {/* 空状态 */}
        {entries.length === 0 && <p className="text-sm text-text-muted text-center py-8">{t('log.empty')}</p>}

        {/* 日志列表（最新在前） */}
        {entries.length > 0 && (
          <div className="flex flex-col gap-1 max-h-[600px] overflow-y-auto">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-1 px-2.5 py-2 bg-bg-secondary rounded text-xs">
                {/* 第一行：状态 + 域名 + 记录类型 + 时间 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={entry.success ? BadgeVariant.SUCCESS : BadgeVariant.DANGER}>
                      {entry.success ? 'OK' : 'FAIL'}
                    </Badge>
                    <span className="font-medium">{entry.domain}</span>
                    <span className="text-text-muted">{entry.recordType}</span>
                  </div>
                  <span className="text-text-muted">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                {/* 第二行：协议 + 服务器 + 延迟 */}
                <div className="flex items-center gap-2 text-text-muted">
                  <span>
                    {entry.protocol.toUpperCase()} → {entry.server}
                  </span>
                  <span>{Math.round(entry.latencyMs)}ms</span>
                </div>
                {/* 错误详情 */}
                {entry.detail && <span className="text-danger">{entry.detail}</span>}
                {/* 解析结果 */}
                {entry.answers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {entry.answers.map((ans: string, i: number) => (
                      <code key={i} className="text-xs bg-bg-card px-1.5 py-0.5 rounded">
                        {ans}
                      </code>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </ErrorBoundary>
  );
}
