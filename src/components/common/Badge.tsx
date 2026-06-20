import type { ReactNode } from 'react'

export const BadgeVariant = {
  DEFAULT: 'default',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'danger',
  INFO: 'info',
} as const
export type BadgeVariant = (typeof BadgeVariant)[keyof typeof BadgeVariant]

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
}

const variantClasses: Record<BadgeVariant, string> = {
  [BadgeVariant.DEFAULT]: 'bg-bg-secondary text-text-muted',
  [BadgeVariant.SUCCESS]: 'bg-success-bg text-success',
  [BadgeVariant.WARNING]: 'bg-warning-bg text-warning',
  [BadgeVariant.DANGER]: 'bg-danger-bg text-danger',
  [BadgeVariant.INFO]: 'bg-info-bg text-info',
}

export function Badge({ children, variant = BadgeVariant.DEFAULT }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  )
}
