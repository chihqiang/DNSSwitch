import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { DnsSwitcher } from '@/components/DnsSwitcher'
import { DnsServerList } from '@/components/DnsServerList'
import { AddServerForm } from '@/components/AddServerForm'
import { Modal, Button, ButtonVariant } from '@/components/common'
import { useDnsServers } from '@/hooks'
import type { DnsServer } from '@/types'

export function ServersPage() {
  const { t } = useTranslation()
  const [editingServer, setEditingServer] = useState<DnsServer | null>(null)
  const [showAddServer, setShowAddServer] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const { addCustomServer, editServer, deleteServer } = useDnsServers()

  const handleEdit = (server: DnsServer) => {
    setEditingServer(server)
    setShowAddServer(true)
  }

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    deleteServer(deleteTarget.id)
    setDeleteTarget(null)
  }

  const handleFormSubmit = useCallback(
    (server: DnsServer) => {
      if (editingServer) {
        editServer(server.id, {
          name: server.name,
          addresses: server.addresses,
          tags: server.tags,
        })
      } else {
        addCustomServer(server)
      }
      setShowAddServer(false)
      setEditingServer(null)
    },
    [editingServer, addCustomServer, editServer]
  )

  function closeForm() {
    setShowAddServer(false)
    setEditingServer(null)
  }

  return (
    <>
      <DnsSwitcher />
      <DnsServerList
        onEdit={handleEdit}
        onAdd={() => setShowAddServer(true)}
        onDelete={(id, name) => setDeleteTarget({ id, name })}
      />

      <Modal
        isOpen={showAddServer}
        onClose={closeForm}
        title={editingServer ? t('server.edit_title') : t('server.add_title')}
      >
        <AddServerForm
          editingServer={editingServer}
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
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant={ButtonVariant.SECONDARY} onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant={ButtonVariant.DANGER} onClick={handleDeleteConfirm}>
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
