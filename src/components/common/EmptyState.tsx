import type { ReactNode } from 'react'

interface Props {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon = '-', title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="text-2xl text-text-muted">{icon}</span>
      <p className="text-sm text-text-muted font-medium">{title}</p>
      {description && <p className="text-xs text-text-muted/70 max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
