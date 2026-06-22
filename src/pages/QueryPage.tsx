import { useState, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { Button, ButtonVariant, EmptyState, ErrorBoundary } from '@/components/common';
import { useDnsServers } from '@/hooks';
import { useRequestLogStore } from '@/stores';
import type { DnsQueryResult } from '@/types';

function friendlyError(t: ReturnType<typeof useTranslation>['t'], raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('timed out') || lower.includes('timeout')) return t('common.error_timeout');
  if (lower.includes('connection refused') || lower.includes('actively refused'))
    return t('common.error_connection_refused');
  if (lower.includes('dns') && (lower.includes('resolve') || lower.includes('failed')))
    return t('common.error_dns_resolve');
  if (lower.includes('invalid') || lower.includes('malformed')) return t('common.error_invalid_response');
  return raw;
}

const RECORD_TYPES = [
  { value: 'A', label: 'A' },
  { value: 'AAAA', label: 'AAAA' },
  { value: 'MX', label: 'MX' },
  { value: 'TXT', label: 'TXT' },
  { value: 'NS', label: 'NS' },
  { value: 'CNAME', label: 'CNAME' },
  { value: 'SOA', label: 'SOA' },
];

const PROTOCOLS = [
  { value: 'udp', label: 'UDP' },
  { value: 'doh', label: 'DoH' },
  { value: 'dot', label: 'DoT' },
];

const ENDPOINT_LABEL_KEYS: Record<string, string> = {
  udp: 'query.endpoint_udp',
  doh: 'query.endpoint_doh',
  dot: 'query.endpoint_dot',
};

const ENDPOINT_PLACEHOLDER_KEYS: Record<string, string> = {
  udp: 'query.placeholder_udp',
  doh: 'query.placeholder_doh',
  dot: 'query.placeholder_dot',
};

export function QueryPage() {
  const { t } = useTranslation();
  const { servers } = useDnsServers();
  const [domain, setDomain] = useState('');
  const [recordType, setRecordType] = useState('A');
  const [protocol, setProtocol] = useState('udp');
  const [endpoint, setEndpoint] = useState('');
  const [result, setResult] = useState<DnsQueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addLogEntry = useRequestLogStore((s) => s.addEntry);

  const serverOptions = useMemo(() => {
    if (protocol === 'udp') {
      return servers
        .filter((s) => s.addresses.length > 0)
        .map((s) => ({
          value: s.addresses[0],
          label: `${s.name} (${s.addresses[0]})`,
        }));
    }
    if (protocol === 'doh') {
      return servers.filter((s) => s.dohUrl).map((s) => ({ value: s.dohUrl!, label: `${s.name} (DoH)` }));
    }
    return servers.filter((s) => s.dotAddress).map((s) => ({ value: s.dotAddress!, label: `${s.name} (DoT)` }));
  }, [servers, protocol]);

  const hasEndpoint = endpoint.trim().length > 0;

  const handleQuery = useCallback(async () => {
    if (!domain.trim()) return;
    const ep = endpoint.trim() || serverOptions[0]?.value;
    if (!ep) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      let res: DnsQueryResult;
      if (protocol === 'doh') {
        res = await invoke<DnsQueryResult>('resolve_dns_doh', {
          domain: domain.trim(),
          recordType,
          dohUrl: ep,
        });
      } else if (protocol === 'dot') {
        res = await invoke<DnsQueryResult>('resolve_dns_dot', {
          domain: domain.trim(),
          recordType,
          dotAddress: ep,
        });
      } else {
        res = await invoke<DnsQueryResult>('resolve_dns', {
          domain: domain.trim(),
          recordType,
          address: ep,
        });
      }
      setResult(res);
      addLogEntry({
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        type: 'dns_query',
        domain: domain.trim(),
        server: res.server,
        protocol,
        recordType: res.recordType,
        latencyMs: res.latencyMs,
        success: true,
        answers: res.answers,
      });
    } catch (e) {
      setError(String(e));
      addLogEntry({
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        type: 'dns_query',
        domain: domain.trim(),
        server: endpoint || protocol,
        protocol,
        recordType,
        latencyMs: 0,
        success: false,
        answers: [],
        detail: String(e),
      });
    } finally {
      setIsLoading(false);
    }
  }, [domain, recordType, protocol, endpoint, serverOptions, addLogEntry]);

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 bg-bg-secondary rounded-lg p-4">
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-[0.05em]">
                {t('query.domain')}
              </label>
              <input
                className="px-2.5 py-1.5 text-sm bg-bg-card border-0 rounded focus:outline-none focus:ring-2 focus:ring-accent w-full"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleQuery(); }}
                placeholder={t('query.domain_placeholder')}
              />
            </div>

            <div className="flex flex-col gap-1.5 min-w-[80px]">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-[0.05em]">
                {t('query.record_type')}
              </label>
              <select
                className="px-2.5 py-1.5 text-sm bg-bg-card border-0 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
              >
                {RECORD_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 min-w-[80px]">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-[0.05em]">
                {t('query.protocol')}
              </label>
              <div className="flex gap-px bg-border rounded overflow-hidden">
                {PROTOCOLS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`px-3 py-1.5 text-sm transition-colors duration-150 ${
                      protocol === opt.value
                        ? 'bg-accent text-white'
                        : 'bg-bg-card text-text-secondary hover:text-text-primary'
                    }`}
                    onClick={() => {
                      setProtocol(opt.value);
                      setEndpoint('');
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-[0.05em]">
                {t(ENDPOINT_LABEL_KEYS[protocol])}
              </label>
              <div className="flex gap-2">
                <input
                  className="px-2.5 py-1.5 text-sm bg-bg-card border-0 rounded focus:outline-none focus:ring-2 focus:ring-accent flex-1 min-w-0"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder={t(ENDPOINT_PLACEHOLDER_KEYS[protocol])}
                />
                <Button
                  variant={ButtonVariant.PRIMARY}
                  onClick={handleQuery}
                  isLoading={isLoading}
                  disabled={!domain.trim()}
                >
                  {t('query.resolve')}
                </Button>
              </div>
            </div>

            {serverOptions.length > 0 && (
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-[0.05em]">
                  {t('query.quick_select')}
                </label>
                <select
                  className="px-2.5 py-1.5 text-sm bg-bg-card border-0 rounded focus:outline-none focus:ring-2 focus:ring-accent"
                  value={hasEndpoint && serverOptions.some((o) => o.value === endpoint) ? endpoint : ''}
                  onChange={(e) => setEndpoint(e.target.value)}
                >
                  <option value="">{t('common.custom')}</option>
                  {serverOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {servers.length === 0 && (
          <EmptyState icon="~" title={t('query.no_servers_title')} description={t('query.no_servers_desc')} />
        )}

        {error && (
          <div className="px-3.5 py-2 bg-danger-bg text-danger border border-danger/20 rounded-lg text-xs">
            {friendlyError(t, error)}
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span className="flex items-center gap-1.5">
                <span className="text-text-muted">{t('query.server')}:</span>
                <span className="text-text-primary font-medium">{result.server}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-text-muted">{t('query.latency')}:</span>
                <span className="text-text-primary font-medium">{t('status.latency_ms', { latency: Math.round(result.latencyMs) })}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-text-muted">{t('query.record_type')}:</span>
                <span className="text-text-primary font-medium">{result.recordType}</span>
              </span>
            </div>

            {result.answers.length > 0 ? (
              <div className="flex flex-col bg-bg-secondary rounded-lg overflow-hidden">
                {result.answers.map((ans, i) => (
                  <div
                    key={i}
                    className="px-3.5 py-2.5 text-sm font-mono text-text-primary border-t border-border/50 first:border-t-0 hover:bg-border/30 transition-colors"
                  >
                    {ans}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3.5 py-5 text-sm text-text-muted text-center bg-bg-secondary rounded-lg">
                {t('query.no_results')}
              </div>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
