interface Props {
  size?: number;
  className?: string;
}

export function LoadingSpinner({ size = 16, className = '' }: Props) {
  return (
    <svg
      className={`animate-spin text-text-muted ${className}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
