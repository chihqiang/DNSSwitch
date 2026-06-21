// ============================================================
// ServersPage DNS 服务器管理页面
// 展示服务器列表，支持添加/编辑/删除操作
// ============================================================

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DnsServerList } from '@/components/DnsServerList';
import { AddServerForm } from '@/components/AddServerForm';
import { Modal, ConfirmDialog, ErrorBoundary } from '@/components/common';
import { useDnsServers } from '@/hooks';
import { useToastStore } from '@/stores/toastStore';
import type { DnsServer } from '@/types';

export function ServersPage() {
  const { t } = useTranslation();
  const [editingServer, setEditingServer] = useState<DnsServer | null>(null);
  const [showAddServer, setShowAddServer] = useState(false);
  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { addCustomServer, editServer, deleteServer } = useDnsServers();

  const handleEdit = useCallback((server: DnsServer) => {
    setEditingServer(server);
    setShowAddServer(true);
  }, []);

  const handleAdd = useCallback(() => setShowAddServer(true), []);

  const handleDeleteRequest = useCallback((id: string, name: string) => {
    setDeleteTarget({ id, name });
  }, []);

  const closeForm = useCallback(() => {
    setShowAddServer(false);
    setEditingServer(null);
  }, []);

  /** 确认删除服务器 */
  const handleDeleteConfirm = useCallback(async () => {
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
  }, [deleteTarget, deleteServer]);

  /** 表单提交（新增或编辑） */
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
      } catch (e) {
        useToastStore.getState().addToast('error', String(e));
      }
    },
    [editingServer, addCustomServer, editServer],
  );

  const handleCloseConfirm = useCallback(() => {
    setDeleteTarget(null);
    setDeleteError(null);
  }, []);

  return (
    <ErrorBoundary>
      <DnsServerList onEdit={handleEdit} onAdd={handleAdd} onDelete={handleDeleteRequest} />

      {/* 添加/编辑服务器弹窗 */}
      <Modal
        isOpen={showAddServer}
        onClose={closeForm}
        title={editingServer ? t('server.edit_title') : t('server.add_title')}
      >
        <AddServerForm editingServer={editingServer} onSubmit={handleFormSubmit} onCancel={closeForm} />
      </Modal>

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={handleCloseConfirm}
        title={t('common.confirm')}
        message={deleteTarget ? t('common.confirm_delete', { name: deleteTarget.name }) : ''}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
        error={deleteError}
      />
    </ErrorBoundary>
  );
}
