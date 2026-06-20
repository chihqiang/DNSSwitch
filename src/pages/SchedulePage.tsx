import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SchedulePanel } from '@/components/Schedule'
import { AddRuleForm } from '@/components/AddRuleForm'
import { Modal, Button, ButtonVariant, ErrorBoundary } from '@/components/common'
import { useConfigStore } from '@/stores'
import type { ScheduleRule } from '@/types'

export function SchedulePage() {
  const { t } = useTranslation()
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null)
  const [showAddRule, setShowAddRule] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { addScheduleRule, updateScheduleRule, removeScheduleRule } = useConfigStore()

  const handleEdit = (rule: ScheduleRule) => {
    setEditingRule(rule)
    setShowAddRule(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await removeScheduleRule(deleteTarget.id)
      setDeleteTarget(null)
    } catch (e) {
      setDeleteError(String(e))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleFormSubmit = useCallback(
    (rule: ScheduleRule) => {
      if (editingRule) {
        updateScheduleRule(rule.id, {
          name: rule.name,
          condition: rule.condition,
          action: rule.action,
          priority: rule.priority,
          description: rule.description,
        })
      } else {
        addScheduleRule(rule)
      }
      setShowAddRule(false)
      setEditingRule(null)
    },
    [editingRule, addScheduleRule, updateScheduleRule]
  )

  function closeForm() {
    setShowAddRule(false)
    setEditingRule(null)
  }

  return (
    <ErrorBoundary>
      <SchedulePanel
        onAdd={() => setShowAddRule(true)}
        onEdit={handleEdit}
        onDelete={(id, name) => setDeleteTarget({ id, name })}
      />

      <Modal
        isOpen={showAddRule}
        onClose={closeForm}
        title={editingRule ? t('schedule.edit_title') : t('schedule.add_title')}
      >
        <AddRuleForm
          editingRule={editingRule}
          onSubmit={handleFormSubmit}
          onCancel={closeForm}
        />
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('common.confirm')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {deleteTarget && t('common.confirm_delete', { name: deleteTarget.name })}
          </p>
          {deleteError && <p className="text-xs text-danger">{deleteError}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant={ButtonVariant.SECONDARY} onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              {t('common.cancel')}
            </Button>
            <Button variant={ButtonVariant.DANGER} onClick={handleDeleteConfirm} isLoading={isDeleting}>
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </ErrorBoundary>
  )
}
