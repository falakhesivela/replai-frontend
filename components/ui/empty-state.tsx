import type { LucideIcon } from 'lucide-react'
import { cn } from './cn'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  /** 'card' draws a dashed bordered container; 'bare' is just the centered
   *  content (for use inside an existing Card/section). */
  variant?: 'card' | 'bare'
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'bare',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        variant === 'card' &&
          'rounded-xl border border-dashed border-line-strong bg-surface',
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft ring-1 ring-accent/15">
        <Icon size={22} strokeWidth={1.5} className="text-accent-text/70" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-ink-2">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
