import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DnsServerList } from '@/components/DnsServerList';
import { AddServerForm } from '@/components/AddServerForm';
import { Modal, Button, ButtonVariant, ErrorBoundary } from '@/components/common';
import { useDnsServers } from '@/hooks';
import type { DnsServer } from '@/types';

export function ServersPage() {
  const { t } = useTranslation();
  const [editingServer, setEditingServer] = useState<DnsServer | null>(null);
  const [showAddServer, setShowAddServer] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { addCustomServer, editServer, deleteServer } = useDnsServers();

  const handleEdit = (server: DnsServer) => {
    setEditingServer(server);
    setShowAddServer(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteServer(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(String(e));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormSubmit = useCallback(
    async (server: DnsServer) => {
      try {
        if (editingServer) {
          await editServer(server.id, {
            name: server.name,
            addresses: server.addresses,
            tags: server.tags,
            dohUrl: server.dohUrl,
            dotAddress: server.dotAddress,
          });
        } else {
          await addCustomServer(server);
        }
        setShowAddServer(false);
        setEditingServer(null);
      } catch {
        // error handled by store
      }
    },
    [editingServer, addCustomServer, editServer],
  );

  function closeForm() {
    setShowAddServer(false);
    setEditingServer(null);
  }

  return (
    <ErrorBoundary>
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
        <AddServerForm editingServer={editingServer} onSubmit={handleFormSubmit} onCancel={closeForm} />
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('common.confirm')}>
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
  );
}
