import { cn } from './cn'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 ring-line',
  success: 'bg-success-soft text-success ring-success/20',
  warning: 'bg-warning-soft text-warning ring-warning/20',
  danger: 'bg-danger-soft text-danger ring-danger/20',
  info: 'bg-info-soft text-info ring-info/20',
  accent: 'bg-accent-soft text-accent-text ring-accent/20',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1',
        TONES[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
