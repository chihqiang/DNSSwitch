import { useState, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'
import { Button, ButtonVariant, Card, Select, EmptyState, ErrorBoundary } from '@/components/common'
import { useDnsServers } from '@/hooks'
import { useRequestLogStore } from '@/stores'

interface DnsQueryResult {
  domain: string
  recordType: string
  answers: string[]
  server: string
  latencyMs: number
}

const RECORD_TYPES = [
  { value: 'A', label: 'A' },
  { value: 'AAAA', label: 'AAAA' },
  { value: 'MX', label: 'MX' },
  { value: 'TXT', label: 'TXT' },
  { value: 'NS', label: 'NS' },
  { value: 'CNAME', label: 'CNAME' },
  { value: 'SOA', label: 'SOA' },
]

const PROTOCOLS = [
  { value: 'udp', label: 'UDP' },
  { value: 'doh', label: 'DoH' },
  { value: 'dot', label: 'DoT' },
]

const ENDPOINT_LABELS: Record<string, string> = {
  udp: 'DNS Server',
  doh: 'DoH URL',
  dot: 'DoT Address',
}

const ENDPOINT_PLACEHOLDERS: Record<string, string> = {
  udp: '1.1.1.1',
  doh: 'https://dns.example.com/dns-query',
  dot: '1.1.1.1',
}

export function QueryPage() {
  const { t } = useTranslation()
  const { servers } = useDnsServers()
  const [domain, setDomain] = useState('')
  const [recordType, setRecordType] = useState('A')
  const [protocol, setProtocol] = useState('udp')
  const [endpoint, setEndpoint] = useState('')
  const [result, setResult] = useState<DnsQueryResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const addLogEntry = useRequestLogStore((s) => s.addEntry)

  const serverOptions = useMemo(() => {
    if (protocol === 'udp') {
      return servers
        .filter((s) => s.addresses.length > 0)
        .map((s) => ({ value: s.addresses[0], label: `${s.name} (${s.addresses[0]})` }))
    }
    if (protocol === 'doh') {
      return servers
        .filter((s) => s.dohUrl)
        .map((s) => ({ value: s.dohUrl!, label: `${s.name} (DoH)` }))
    }
    return servers
      .filter((s) => s.dotAddress)
      .map((s) => ({ value: s.dotAddress!, label: `${s.name} (DoT)` }))
  }, [servers, protocol])

  const hasEndpoint = endpoint.trim().length > 0

  const handleQuery = useCallback(async () => {
    if (!domain.trim()) return
    const ep = endpoint.trim() || serverOptions[0]?.value
    if (!ep) return

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      let res: DnsQueryResult
      if (protocol === 'doh') {
        res = await invoke<DnsQueryResult>('resolve_dns_doh', {
          domain: domain.trim(),
          recordType,
          dohUrl: ep,
        })
      } else if (protocol === 'dot') {
        res = await invoke<DnsQueryResult>('resolve_dns_dot', {
          domain: domain.trim(),
          recordType,
          dotAddress: ep,
        })
      } else {
        res = await invoke<DnsQueryResult>('resolve_dns', {
          domain: domain.trim(),
          recordType,
          address: ep,
        })
      }
      setResult(res)
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
      })
    } catch (e) {
      setError(String(e))
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
      })
    } finally {
      setIsLoading(false)
    }
  }, [domain, recordType, protocol, endpoint, serverOptions])

  return (
    <ErrorBoundary>
      <Card className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold">{t('query.title')}</h2>

      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs text-text-secondary">{t('query.domain')}</label>
            <input
              className="px-2.5 py-1.5 text-sm bg-bg-secondary border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent w-full"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              placeholder={t('query.domain_placeholder')}
            />
          </div>

          <Select
            label={t('query.record_type')}
            options={RECORD_TYPES}
            value={recordType}
            onChange={(e) => setRecordType(e.target.value)}
          />

          <div className="flex flex-col gap-1.5 min-w-[90px]">
            <label className="text-xs text-text-secondary">{t('query.protocol')}</label>
            <select
              className="px-2.5 py-1.5 text-sm bg-bg-secondary border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent"
              value={protocol}
              onChange={(e) => { setProtocol(e.target.value); setEndpoint('') }}
            >
              {PROTOCOLS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs text-text-secondary">{ENDPOINT_LABELS[protocol]}</label>
            <div className="flex gap-2">
              <input
                className="px-2.5 py-1.5 text-sm bg-bg-secondary border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent flex-1 min-w-0"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder={ENDPOINT_PLACEHOLDERS[protocol]}
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
              <label className="text-xs text-text-secondary">{t('query.quick_select')}</label>
              <select
                className="px-2.5 py-1.5 text-sm bg-bg-secondary border border-border rounded focus:outline-none focus:ring-2 focus:ring-accent"
                value={hasEndpoint && serverOptions.some((o) => o.value === endpoint) ? endpoint : ''}
                onChange={(e) => setEndpoint(e.target.value)}
              >
                <option value="">{t('common.custom')}</option>
                {serverOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {servers.length === 0 && (
        <EmptyState
          icon="~"
          title={t('query.no_servers_title')}
          description={t('query.no_servers_desc')}
        />
      )}

      {error && (
        <div className="px-3 py-2 bg-danger-bg text-danger border border-danger/20 rounded text-xs">
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span>{t('query.server')}: {result.server}</span>
            <span>{t('query.latency')}: {Math.round(result.latencyMs)}ms</span>
            <span>{t('query.record_type')}: {result.recordType}</span>
          </div>

          {result.answers.length > 0 ? (
            <div className="flex flex-col gap-1">
              {result.answers.map((ans, i) => (
                <div key={i} className="px-3 py-2 bg-bg-secondary rounded text-sm font-mono">
                  {ans}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 bg-bg-secondary rounded text-sm text-text-muted">
              {t('query.no_results')}
            </div>
          )}
        </div>
      )}
    </Card>
    </ErrorBoundary>
  )
}
