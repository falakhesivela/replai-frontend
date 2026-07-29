import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from './cn'
import { Card } from './card'

interface StatCardProps {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  /** Percent change vs previous period; renders a delta pill. */
  delta?: number | null
  /** When a decrease is good news (e.g. response time), flip the pill color. */
  deltaDownIsGood?: boolean
  /** Small print under the value (e.g. "vs previous 30 days"). */
  caption?: string
  /** Sparkline or any small chart, rendered under the value. */
  chart?: React.ReactNode
  /** Emphasize with a soft accent glow (dark mode hero stats). */
  glow?: boolean
  className?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaDownIsGood = false,
  caption,
  chart,
  glow = false,
  className,
}: StatCardProps) {
  const hasDelta = delta != null && Number.isFinite(delta)
  const up = (delta ?? 0) >= 0
  const good = deltaDownIsGood ? !up : up

  return (
    <Card
      padding="sm"
      className={cn(glow && 'shadow-glow-accent', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-3">
          {label}
        </p>
        {Icon && <Icon size={15} strokeWidth={1.75} className="text-ink-3" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink">
          {value}
        </p>
        {hasDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums',
              good ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
            )}
          >
            {up ? (
              <ArrowUpRight size={11} strokeWidth={2} />
            ) : (
              <ArrowDownRight size={11} strokeWidth={2} />
            )}
            {Math.abs(delta!).toFixed(Math.abs(delta!) >= 10 ? 0 : 1)}%
          </span>
        )}
      </div>
      {caption && <p className="mt-1 text-xs text-ink-3">{caption}</p>}
      {chart && <div className="mt-3">{chart}</div>}
    </Card>
  )
}
