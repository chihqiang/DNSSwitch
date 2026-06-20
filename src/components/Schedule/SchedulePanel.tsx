// ============================================================
// SchedulePanel 调度面板组件
// 展示调度总开关、规则列表，支持添加/编辑/删除规则
// ============================================================

import { useTranslation } from 'react-i18next';
import type { ScheduleRule as ScheduleRuleType } from '@/types';
import { useConfigStore } from '@/stores';
import { ScheduleRule } from './ScheduleRule';
import { Card, Button, ButtonVariant } from '@/components/common';

interface SchedulePanelProps {
  onAdd: () => void;
  onEdit: (rule: ScheduleRuleType) => void;
  onDelete: (id: string, name: string) => void;
}

export function SchedulePanel({ onAdd, onEdit, onDelete }: SchedulePanelProps) {
  const { t } = useTranslation();
  const config = useConfigStore((s) => s.config);
  const { rules, enabled } = config.schedule;

  /** 切换单条规则的启用/禁用状态 */
  function handleToggle(id: string) {
    const rule = rules.find((r) => r.id === id);
    if (rule) {
      useConfigStore.getState().updateScheduleRule(id, { enabled: !rule.enabled });
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-3">
      {/* 头部：标题 + 总开关 + 添加按钮 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('schedule.title')}</h2>
        <div className="flex items-center gap-3">
          {/* 调度总开关（自定义 toggle） */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only"
              checked={enabled}
              onChange={(e) => useConfigStore.getState().setScheduleEnabled(e.target.checked)}
            />
            <span
              className={`w-9 h-5 rounded-full transition-colors duration-200 relative ${enabled ? 'bg-accent' : 'bg-border'}`}
            >
              <span
                className={`absolute w-4 h-4 bg-white rounded-full top-0.5 left-0.5 transition-transform duration-200 ${enabled ? 'translate-x-4' : ''}`}
              />
            </span>
          </label>
          <Button variant={ButtonVariant.PRIMARY} size="sm" onClick={onAdd}>
            {t('schedule.add_rule')}
          </Button>
        </div>
      </div>

      {/* 禁用提示 */}
      {!enabled && <p className="text-sm text-text-muted text-center py-6">{t('schedule.disabled_hint')}</p>}

      {/* 空状态提示 */}
      {enabled && rules.length === 0 && (
        <p className="text-sm text-text-muted text-center py-6">{t('schedule.empty_hint')}</p>
      )}

      {/* 规则列表 */}
      {enabled && rules.length > 0 && (
        <div className="flex flex-col gap-2">
          {rules.map((rule) => (
            <ScheduleRule key={rule.id} rule={rule} onToggle={handleToggle} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </Card>
  );
}
