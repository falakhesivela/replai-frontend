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
          'rounded-lg border border-dashed border-gray-300 bg-white',
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <Icon size={22} strokeWidth={1.5} className="text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-gray-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
