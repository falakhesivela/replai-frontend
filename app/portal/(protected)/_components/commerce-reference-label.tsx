import { formatCommerceReference } from '@/lib/commerce-search'

export function CommerceReferenceLabel({
  id,
  className = '',
}: {
  id: string
  className?: string
}) {
  return (
    <span
      className={`font-mono text-xs font-semibold uppercase tracking-wide text-gray-600 ${className}`}
      title="Customer confirmation reference"
    >
      {formatCommerceReference(id)}
    </span>
  )
}
