// ============================================================
// SchedulePage 调度管理页面
// 展示调度规则列表，支持添加/编辑/删除操作
// ============================================================

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SchedulePanel } from '@/components/Schedule';
import { AddRuleForm } from '@/components/AddRuleForm';
import { Modal, ConfirmDialog, ErrorBoundary } from '@/components/common';
import { useConfigStore } from '@/stores';
import type { ScheduleRule } from '@/types';

export function SchedulePage() {
  const { t } = useTranslation();
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { addScheduleRule, updateScheduleRule, removeScheduleRule } = useConfigStore();

  /** 编辑规则 */
  const handleEdit = (rule: ScheduleRule) => {
    setEditingRule(rule);
    setShowAddRule(true);
  };

  /** 确认删除规则 */
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await removeScheduleRule(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(String(e));
    } finally {
      setIsDeleting(false);
    }
  };

  /** 表单提交（新增或编辑） */
  const handleFormSubmit = useCallback(
    (rule: ScheduleRule) => {
      if (editingRule) {
        updateScheduleRule(rule.id, {
          name: rule.name,
          condition: rule.condition,
          action: rule.action,
          priority: rule.priority,
          description: rule.description,
        });
      } else {
        addScheduleRule(rule);
      }
      setShowAddRule(false);
      setEditingRule(null);
    },
    [editingRule, addScheduleRule, updateScheduleRule],
  );

  function closeForm() {
    setShowAddRule(false);
    setEditingRule(null);
  }

  return (
    <ErrorBoundary>
      <SchedulePanel
        onAdd={() => setShowAddRule(true)}
        onEdit={handleEdit}
        onDelete={(id, name) => setDeleteTarget({ id, name })}
      />

      {/* 添加/编辑规则弹窗 */}
      <Modal
        isOpen={showAddRule}
        onClose={closeForm}
        title={editingRule ? t('schedule.edit_title') : t('schedule.add_title')}
      >
        <AddRuleForm editingRule={editingRule} onSubmit={handleFormSubmit} onCancel={closeForm} />
      </Modal>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        title={t('common.confirm')}
        message={deleteTarget ? t('common.confirm_delete', { name: deleteTarget.name }) : ''}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
        error={deleteError}
      />
    </ErrorBoundary>
  );
}
