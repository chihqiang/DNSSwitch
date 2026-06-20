import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="text-2xl">!</span>
            <p className="text-sm text-danger font-medium">Something went wrong</p>
            <p className="text-xs text-text-muted max-w-md">{this.state.error?.message}</p>
          </div>
        )
      )
    }
    return this.props.children
  }
}
