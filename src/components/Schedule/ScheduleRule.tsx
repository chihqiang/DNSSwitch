import { useTranslation } from 'react-i18next'
import type { ScheduleRule as ScheduleRuleType } from '@/types'
import { ScheduleConditionType as CondType } from '@/types'
import { Card, Badge, Button, ButtonVariant, BadgeVariant } from '@/components/common'

interface ScheduleRuleProps {
  rule: ScheduleRuleType
  onToggle: (id: string) => void
  onEdit: (rule: ScheduleRuleType) => void
  onDelete: (id: string, name: string) => void
}

export function ScheduleRule({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: ScheduleRuleProps) {
  const { t } = useTranslation()

  const conditionLabel =
    rule.condition.type === CondType.TIME
      ? t('schedule.condition_time', { start: rule.condition.timeRange.start, end: rule.condition.timeRange.end })
      : rule.condition.type === CondType.NETWORK
        ? t('schedule.condition_network', { name: rule.condition.ssid || rule.condition.interfaceName || t('common.unknown') })
        : t('schedule.condition_always')

  const typeLabel =
    rule.condition.type === CondType.TIME
      ? t('schedule.type_time')
      : rule.condition.type === CondType.NETWORK
        ? t('schedule.type_network')
        : t('schedule.type_always')

  return (
    <Card className={`flex flex-col gap-3 p-3 ${!rule.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{rule.name}</h4>
          <span className="inline-flex">
            <Badge variant={BadgeVariant.INFO}>{typeLabel}</Badge>
          </span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only"
            checked={rule.enabled}
            onChange={() => onToggle(rule.id)}
          />
          <span className={`w-9 h-5 rounded-full transition-colors duration-200 relative ${rule.enabled ? 'bg-accent' : 'bg-border'}`}>
            <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 left-0.5 transition-transform duration-200 ${rule.enabled ? 'translate-x-4' : ''}`} />
          </span>
        </label>
      </div>

      <div className="text-sm text-text-secondary">
        <p className="m-0">{conditionLabel}</p>
        {rule.description && (
          <p className="mt-1 text-xs text-text-muted">{rule.description}</p>
        )}
      </div>

      <div className="flex gap-1.5 pt-3 border-t border-border">
        <Button variant={ButtonVariant.GHOST} size="sm" onClick={() => onEdit(rule)}>
          {t('common.edit')}
        </Button>
        <Button
          variant={ButtonVariant.DANGER}
          size="sm"
          onClick={() => onDelete(rule.id, rule.name)}
        >
          {t('common.delete')}
        </Button>
      </div>
    </Card>
  )
}
