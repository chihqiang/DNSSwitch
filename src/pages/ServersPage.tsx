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

  /** 编辑服务器 */
  const handleEdit = (server: DnsServer) => {
    setEditingServer(server);
    setShowAddServer(true);
  };

  /** 确认删除服务器 */
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
      } catch {
        // 错误由 store 处理
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
