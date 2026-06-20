// ============================================================
// AddRuleForm 调度规则表单组件
// 支持添加/编辑调度规则，含时间、网络、Cron、启动、始终五种条件类型
// ============================================================

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScheduleRule } from '@/types';
import { ScheduleConditionType } from '@/types';
import { Button, ButtonVariant } from '@/components/common';
import { useDnsStore } from '@/stores';
import {
  inputClass,
  INPUT_CLASS,
  INPUT_CLASS_DEFAULT,
  INPUT_FOCUS,
  LABEL_CLASS,
  ERROR_CLASS,
} from '@/components/common/forms';

/** 星期几列表 */
const DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_KEYS = [
  'schedule.day_sun',
  'schedule.day_mon',
  'schedule.day_tue',
  'schedule.day_wed',
  'schedule.day_thu',
  'schedule.day_fri',
  'schedule.day_sat',
];

/** 下拉选择框样式 */
const SELECT_CLASS = `${INPUT_CLASS_DEFAULT} bg-bg-card text-text-primary text-sm px-3 py-2 border rounded outline-none cursor-pointer`;

interface AddRuleFormProps {
  editingRule?: ScheduleRule | null;
  onSubmit: (rule: ScheduleRule) => void;
  onCancel: () => void;
}

export function AddRuleForm({ editingRule, onSubmit, onCancel }: AddRuleFormProps) {
  const { t } = useTranslation();
  const servers = useDnsStore((s) => s.servers);
  const isEditing = !!editingRule;

  // 表单状态
  const [name, setName] = useState(editingRule?.name ?? '');
  const [condType, setCondType] = useState(editingRule?.condition.type ?? ScheduleConditionType.ALWAYS);
  const [startTime, setStartTime] = useState(
    editingRule?.condition.type === ScheduleConditionType.TIME ? editingRule.condition.timeRange.start : '09:00',
  );
  const [endTime, setEndTime] = useState(
    editingRule?.condition.type === ScheduleConditionType.TIME ? editingRule.condition.timeRange.end : '18:00',
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    editingRule?.condition.type === ScheduleConditionType.TIME ? editingRule.condition.daysOfWeek : [1, 2, 3, 4, 5],
  );
  const [ssid, setSsid] = useState(
    editingRule?.condition.type === ScheduleConditionType.NETWORK ? (editingRule.condition.ssid ?? '') : '',
  );
  const [interfaceName, setInterfaceName] = useState(
    editingRule?.condition.type === ScheduleConditionType.NETWORK ? (editingRule.condition.interfaceName ?? '') : '',
  );
  const [cronExpression, setCronExpression] = useState(
    editingRule?.condition.type === ScheduleConditionType.CRON ? editingRule.condition.expression : '0 */1 * * *',
  );
  const [targetServerId, setTargetServerId] = useState(
    editingRule?.action.targetServerId ?? (servers.length > 0 ? servers[0].id : ''),
  );
  const [priority, setPriority] = useState(editingRule?.priority ?? 0);
  const [description, setDescription] = useState(editingRule?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** 切换某一天的选中状态 */
  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  /** 表单校验 */
  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t('schedule.name_required');
    if (!targetServerId) errs.server = t('schedule.server_required');
    if (condType === ScheduleConditionType.TIME) {
      if (!startTime || !endTime) errs.time = t('schedule.time_required');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  /** 提交表单 */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const now = Date.now();
    let condition: ScheduleRule['condition'];

    if (condType === ScheduleConditionType.TIME) {
      condition = {
        type: ScheduleConditionType.TIME,
        timeRange: { start: startTime, end: endTime },
        daysOfWeek,
      };
    } else if (condType === ScheduleConditionType.NETWORK) {
      condition = {
        type: ScheduleConditionType.NETWORK,
        ssid: ssid.trim() || undefined,
        interfaceName: interfaceName.trim() || undefined,
      };
    } else if (condType === ScheduleConditionType.CRON) {
      condition = {
        type: ScheduleConditionType.CRON,
        expression: cronExpression.trim() || '0 */1 * * *',
      };
    } else if (condType === ScheduleConditionType.STARTUP) {
      condition = { type: ScheduleConditionType.STARTUP };
    } else {
      condition = { type: ScheduleConditionType.ALWAYS };
    }

    const rule: ScheduleRule = {
      id: editingRule?.id ?? `rule-${now}`,
      name: name.trim(),
      enabled: editingRule?.enabled ?? true,
      condition,
      action: { targetServerId },
      priority,
      description: description.trim() || undefined,
    };

    onSubmit(rule);
  }

  /** 条件类型选项 */
  const conditionOptions = [
    { value: ScheduleConditionType.ALWAYS, label: t('schedule.type_always') },
    { value: ScheduleConditionType.TIME, label: t('schedule.type_time') },
    { value: ScheduleConditionType.NETWORK, label: t('schedule.type_network') },
    { value: ScheduleConditionType.CRON, label: 'Cron' },
    { value: ScheduleConditionType.STARTUP, label: t('schedule.type_startup') },
  ];

  return (
    <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
      {/* 规则名称 */}
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>{t('schedule.rule_name')}</label>
        <input
          className={inputClass(errors.name)}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('schedule.rule_name_placeholder')}
          autoFocus
        />
        {errors.name && <span className={ERROR_CLASS}>{errors.name}</span>}
      </div>

      {/* 条件类型 */}
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>{t('schedule.condition_type')}</label>
        <select
          className={`${SELECT_CLASS} ${INPUT_FOCUS}`}
          value={condType}
          onChange={(e) =>
            setCondType(e.target.value as (typeof ScheduleConditionType)[keyof typeof ScheduleConditionType])
          }
        >
          {conditionOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* 时间段条件 */}
      {condType === ScheduleConditionType.TIME && (
        <>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className={LABEL_CLASS}>{t('schedule.start_time')}</label>
              <input className={inputClass()} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className={LABEL_CLASS}>{t('schedule.end_time')}</label>
              <input className={inputClass()} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          {errors.time && <span className={ERROR_CLASS}>{errors.time}</span>}

          <div className="flex flex-col gap-1">
            <label className={LABEL_CLASS}>{t('schedule.days_of_week')}</label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((day) => (
                <label
                  key={day}
                  className="flex items-center gap-1 text-xs cursor-pointer text-text-primary px-2 py-1 rounded bg-bg-secondary hover:bg-border transition-colors duration-150"
                >
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={daysOfWeek.includes(day)}
                    onChange={() => toggleDay(day)}
                  />
                  <span>{t(DAY_KEYS[day])}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 网络条件 */}
      {condType === ScheduleConditionType.NETWORK && (
        <>
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLASS}>{t('schedule.ssid')}</label>
            <input
              className={inputClass()}
              type="text"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder={t('schedule.ssid_placeholder')}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLASS}>{t('schedule.interface_name')}</label>
            <input
              className={inputClass()}
              type="text"
              value={interfaceName}
              onChange={(e) => setInterfaceName(e.target.value)}
              placeholder={t('schedule.interface_name_placeholder')}
            />
          </div>
        </>
      )}

      {/* Cron 条件 */}
      {condType === ScheduleConditionType.CRON && (
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS}>Cron Expression</label>
          <input
            className={inputClass()}
            type="text"
            value={cronExpression}
            onChange={(e) => setCronExpression(e.target.value)}
            placeholder="e.g. 0 */1 * * *"
          />
          <span className="text-xs text-text-muted">{t('schedule.cron_hint')}</span>
        </div>
      )}

      {/* 目标服务器 */}
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>{t('schedule.target_server')}</label>
        {servers.length === 0 ? (
          <p className="text-xs text-text-muted">{t('schedule.no_servers')}</p>
        ) : (
          <select
            className={`${SELECT_CLASS} ${INPUT_FOCUS}`}
            value={targetServerId}
            onChange={(e) => setTargetServerId(e.target.value)}
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        {errors.server && <span className={ERROR_CLASS}>{errors.server}</span>}
      </div>

      {/* 优先级 */}
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>{t('schedule.priority')}</label>
        <input
          className={inputClass()}
          type="number"
          min={0}
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          style={{ width: 100 }}
        />
      </div>

      {/* 描述 */}
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>{t('schedule.description')}</label>
        <textarea
          className={`${INPUT_CLASS} ${INPUT_CLASS_DEFAULT} ${INPUT_FOCUS} resize-y`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('schedule.description_placeholder')}
          rows={2}
        />
      </div>

      {/* 按钮 */}
      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <Button type="button" variant={ButtonVariant.SECONDARY} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant={ButtonVariant.PRIMARY}>
          {isEditing ? t('common.save') : t('common.add')}
        </Button>
      </div>
    </form>
  );
}
