// ============================================================
// ConfirmDialog 确认对话框组件
// 通用二次确认弹窗，默认用于删除操作，支持自定义按钮文字和样式
// ============================================================

import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Button } from './Button';
import { ButtonVariant } from './variants';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
  error?: string | null;
  /** 确认按钮样式，默认为 danger（用于删除操作） */
  variant?: (typeof ButtonVariant)[keyof typeof ButtonVariant];
}

export function ConfirmDialog({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
  isLoading = false,
  error = null,
  variant = ButtonVariant.DANGER,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-secondary">{message}</p>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant={ButtonVariant.SECONDARY} onClick={onClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel ?? t('common.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
