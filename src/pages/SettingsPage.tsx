// ============================================================
// SettingsPage 设置页面
// 简单的包装组件，将保存操作传递给 Settings 面板
// ============================================================

import { ErrorBoundary } from '@/components/common';
import { Settings } from '@/components/Settings';
import { useConfig } from '@/hooks';

export function SettingsPage() {
  const { saveConfig } = useConfig();

  return (
    <ErrorBoundary>
      <Settings onSave={saveConfig} />
    </ErrorBoundary>
  );
}
