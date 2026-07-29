import { cn } from './cn'

/** Shimmering placeholder block. Size it with className (h-*, w-*). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-2', className)}
      aria-hidden="true"
    />
  )
}

/** Card-shaped skeleton: title line + n content lines. */
export function SkeletonCard({
  lines = 3,
  className,
}: {
  lines?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface p-6 shadow-card',
        className
      )}
      aria-hidden="true"
    >
      <Skeleton className="mb-4 h-4 w-1/3" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={i === lines - 1 ? 'h-3 w-2/3' : 'h-3 w-full'} />
        ))}
      </div>
    </div>
  )
}

/** Table-ish skeleton: n full-width rows. */
export function SkeletonRows({
  rows = 5,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
