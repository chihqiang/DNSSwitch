// ============================================================
// ErrorBoundary 错误边界组件（Class 组件，React 要求）
// 捕获子组件树中的渲染错误，显示友好的错误提示
// ============================================================

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/log';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    logger.error(`ErrorBoundary caught: ${error.message}\n${error.stack}`);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultErrorFallback message={this.state.error?.message} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-2xl">!</span>
      <p className="text-sm text-danger font-medium">{t('common.error_occurred')}</p>
      {message && <p className="text-xs text-text-muted max-w-md">{message}</p>}
    </div>
  );
}
