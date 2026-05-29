'use client'

import type { ReactNode } from 'react'
import {
  Calendar,
  CreditCard,
  Package,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import type { WidgetComponent } from '@/lib/api'

function money(currency: string, amount: number): string {
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency || 'ZAR',
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function PreviewCard({
  icon,
  title,
  detail,
}: {
  icon: ReactNode
  title: string
  detail?: string
}) {
  return (
    <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-gray-200/80 bg-white/90 px-2.5 py-2 text-xs text-gray-700 shadow-sm">
      <span className="mt-0.5 shrink-0 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <p className="font-medium text-gray-800">{title}</p>
        {detail && <p className="mt-0.5 text-gray-500">{detail}</p>}
      </div>
    </div>
  )
}

export function MessageComponentsPreview({
  components,
}: {
  components: WidgetComponent[]
}) {
  if (!components.length) return null

  return (
    <div className="mt-1.5 w-full max-w-[95%] space-y-1">
      {components.map((comp, idx) => {
        switch (comp.type) {
          case 'product_grid': {
            const n = comp.products.length
            const names = comp.products
              .slice(0, 2)
              .map((p) => p.name)
              .join(', ')
            return (
              <PreviewCard
                key={idx}
                icon={<Package size={14} />}
                title={`Product catalog${n ? ` (${n})` : ''}`}
                detail={names ? `${names}${n > 2 ? '…' : ''}` : undefined}
              />
            )
          }
          case 'cart_summary': {
            const count = comp.items.reduce((s, i) => s + i.quantity, 0)
            return (
              <PreviewCard
                key={idx}
                icon={<ShoppingBag size={14} />}
                title={`Cart · ${count} item${count === 1 ? '' : 's'}`}
                detail={money(comp.currency, comp.total)}
              />
            )
          }
          case 'payment_cta':
            return (
              <PreviewCard
                key={idx}
                icon={<CreditCard size={14} />}
                title="Order · payment link"
                detail={
                  comp.order_id
                    ? `#${comp.order_id.slice(0, 8)} · ${money(comp.currency, comp.amount)}`
                    : money(comp.currency, comp.amount)
                }
              />
            )
          case 'actions':
            return (
              <PreviewCard
                key={idx}
                icon={<Sparkles size={14} />}
                title="Quick actions"
                detail={comp.actions.map((a) => a.label).join(' · ')}
              />
            )
          case 'service_list':
            return (
              <PreviewCard
                key={idx}
                icon={<Calendar size={14} />}
                title={`Services (${comp.services.length})`}
                detail={comp.services
                  .slice(0, 2)
                  .map((s) => s.name)
                  .join(', ')}
              />
            )
          case 'date_picker':
            return (
              <PreviewCard
                key={idx}
                icon={<Calendar size={14} />}
                title={`Pick a date · ${comp.service_name}`}
                detail={`${comp.dates.length} day${comp.dates.length === 1 ? '' : 's'} available`}
              />
            )
          case 'time_slots':
            return (
              <PreviewCard
                key={idx}
                icon={<Calendar size={14} />}
                title={`Pick a time · ${comp.date_label}`}
                detail={`${comp.slots.length} slot${comp.slots.length === 1 ? '' : 's'}`}
              />
            )
          case 'booking_confirmation':
            return (
              <PreviewCard
                key={idx}
                icon={<Calendar size={14} />}
                title={
                  comp.status === 'confirmed'
                    ? 'Booking confirmed'
                    : 'Booking preview'
                }
                detail={`${comp.service_name} · ${comp.date_label} ${comp.time_label}`}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}
