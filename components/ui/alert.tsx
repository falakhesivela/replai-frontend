import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Info, XCircle } from 'lucide-react'
import { cn } from './cn'

type AlertTone = 'info' | 'warning' | 'danger'

const TONES: Record<AlertTone, { cls: string; icon: LucideIcon }> = {
  info: { cls: 'border-info/25 bg-info-soft text-info', icon: Info },
  warning: {
    cls: 'border-warning/25 bg-warning-soft text-warning',
    icon: AlertTriangle,
  },
  danger: { cls: 'border-danger/25 bg-danger-soft text-danger', icon: XCircle },
}

interface AlertProps {
  tone?: AlertTone
  title?: string
  children: React.ReactNode
  className?: string
}

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const { cls, icon: Icon } = TONES[tone]
  return (
    <div
      role="alert"
      className={cn('flex gap-2.5 rounded-lg border p-3 text-sm', cls, className)}
    >
      <Icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        <div className={cn(title && 'mt-0.5', 'text-ink-2')}>{children}</div>
      </div>
    </div>
  )
}
