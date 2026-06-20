import { useTranslation } from 'react-i18next'
import type { DnsServer } from '@/types'
import { Card, Badge, Button, ButtonVariant, BadgeVariant } from '@/components/common'
import { getLatencyBadgeVariant } from '@/constants'

interface DnsServerCardProps {
  server: DnsServer
  onSwitch: (id: string) => void
  onTest: (id: string) => void
  onEdit: (server: DnsServer) => void
  onDelete: (id: string, name: string) => void
  isSwitching: boolean
  isTesting: boolean
}

export function DnsServerCard({
  server,
  onSwitch,
  onTest,
  onEdit,
  onDelete,
  isSwitching,
  isTesting,
}: DnsServerCardProps) {
  const { t } = useTranslation()
  const latency = server.latency

  return (
    <Card className={`flex flex-col gap-3 p-3 ${server.isActive ? 'border-success' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">{server.name}</h3>
          <span className="text-xs text-text-muted">
            {t('dns_provider.' + server.provider.name)}
          </span>
        </div>
        {server.isActive && <Badge variant={BadgeVariant.SUCCESS}>{t('common.active')}</Badge>}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1">
          {server.addresses.map((addr) => (
            <code key={addr}>{addr}</code>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {latency !== undefined && (
            <Badge variant={getLatencyBadgeVariant(latency)}>
              {t('status.latency_ms', { latency: Math.round(latency) })}
            </Badge>
          )}
          {server.tags.map((tag) => (
            <Badge key={tag} variant={BadgeVariant.INFO}>{t('tag.' + tag)}</Badge>
          ))}
          {server.dohUrl && <Badge variant={BadgeVariant.INFO}>DoH</Badge>}
          {server.dotAddress && <Badge variant={BadgeVariant.INFO}>DoT</Badge>}
        </div>
      </div>

      <div className="flex gap-1.5 pt-3 border-t border-border">
        {!server.isActive && (
          <Button
            variant={ButtonVariant.PRIMARY}
            size="sm"
            onClick={() => onSwitch(server.id)}
            disabled={isSwitching}
            isLoading={isSwitching}
          >
            {t('common.switch')}
          </Button>
        )}
        <Button
          variant={ButtonVariant.GHOST}
          size="sm"
          onClick={() => onTest(server.id)}
          disabled={isTesting}
          isLoading={isTesting}
        >
          {t('common.test')}
        </Button>
        <Button variant={ButtonVariant.GHOST} size="sm" onClick={() => onEdit(server)}>
          {t('common.edit')}
        </Button>
        {!server.isSystem && (
          <Button
            variant={ButtonVariant.DANGER}
            size="sm"
            onClick={() => onDelete(server.id, server.name)}
          >
            {t('common.delete')}
          </Button>
        )}
      </div>
    </Card>
  )
}
