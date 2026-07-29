import type { PaymentStatus } from '@/lib/types'

const STYLES: Record<PaymentStatus, string> = {
  not_required: 'bg-surface-2 text-ink-2 ring-1 ring-line',
  pending: 'bg-warning-soft text-warning ring-1 ring-warning/25',
  paid: 'bg-success-soft text-success ring-1 ring-success/25',
  failed: 'bg-danger-soft text-danger ring-1 ring-danger/25',
}

const LABELS: Record<PaymentStatus, string> = {
  not_required: 'No online pay',
  pending: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Payment failed',
}

export function PaymentStatusBadge({ status }: { status?: PaymentStatus | null }) {
  if (!status || status === 'not_required') return null
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  )
}
