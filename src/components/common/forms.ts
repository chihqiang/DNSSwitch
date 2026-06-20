export const INPUT_CLASS =
  'px-3 py-2 border rounded bg-bg-card text-text-primary text-sm outline-none transition-all duration-150';
export const INPUT_CLASS_ERROR = 'border-danger';
export const INPUT_CLASS_DEFAULT = 'border-border';
export const INPUT_FOCUS = 'focus:border-accent focus:shadow-[0_0_0_1px_var(--accent)]';
export const LABEL_CLASS = 'text-xs font-medium text-text-secondary';
export const ERROR_CLASS = 'text-xs text-danger';

export function inputClass(error?: string): string {
  return `${INPUT_CLASS} ${INPUT_FOCUS} ${error ? INPUT_CLASS_ERROR : INPUT_CLASS_DEFAULT}`;
}
