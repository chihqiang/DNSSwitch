export const BadgeVariant = {
  DEFAULT: 'default',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'danger',
  INFO: 'info',
} as const;
export type BadgeVariant = (typeof BadgeVariant)[keyof typeof BadgeVariant];

export const ButtonVariant = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  DANGER: 'danger',
  GHOST: 'ghost',
} as const;
export type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant];

export const ButtonSize = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
} as const;
export type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize];
