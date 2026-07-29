import { cn } from './cn'

interface ProgressProps {
  /** 0–100. Values over 100 clamp and switch to the danger color. */
  value: number
  /** Optional right-aligned label (e.g. "1,240 / 2,000"). */
  label?: string
  className?: string
}

/** Usage meter. */
export function Progress({ value, label, className }: ProgressProps) {
  const over = value > 100
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-ink-3">{label}</span>
          <span className="font-mono tabular-nums text-ink-2">
            {Math.round(value)}%
          </span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            over ? 'bg-danger' : value >= 80 ? 'bg-warning' : 'bg-accent'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
