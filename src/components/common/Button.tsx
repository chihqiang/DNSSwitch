import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const ButtonVariant = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  DANGER: 'danger',
  GHOST: 'ghost',
} as const
export type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant]

export const ButtonSize = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
} as const
export type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize]

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  [ButtonVariant.PRIMARY]: 'bg-accent text-white border-accent hover:bg-accent-hover',
  [ButtonVariant.SECONDARY]: 'bg-bg-secondary text-text-primary border-border hover:bg-border',
  [ButtonVariant.DANGER]: 'bg-danger text-white border-danger hover:opacity-90',
  [ButtonVariant.GHOST]: 'bg-transparent text-text-secondary border-transparent hover:bg-bg-secondary hover:text-text-primary',
}

const sizeClasses: Record<ButtonSize, string> = {
  [ButtonSize.SM]: 'px-3 py-1 text-xs',
  [ButtonSize.MD]: 'px-4 py-2 text-sm',
  [ButtonSize.LG]: 'px-5 py-2.5 text-base',
}

export function Button({
  children,
  variant = ButtonVariant.PRIMARY,
  size = ButtonSize.MD,
  isLoading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 border rounded-sm font-medium transition-all duration-150 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
