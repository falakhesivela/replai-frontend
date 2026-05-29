import type { PaymentStatus } from '@/lib/types'

const STYLES: Record<PaymentStatus, string> = {
  not_required: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  pending: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
  paid: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  failed: 'bg-red-50 text-red-700 ring-1 ring-red-200',
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
