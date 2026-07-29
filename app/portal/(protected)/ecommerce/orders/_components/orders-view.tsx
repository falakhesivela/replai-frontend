'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, ExternalLink, Loader2, Plus, ShoppingBag } from 'lucide-react'
import { CommerceLookupBar } from '../../../_components/commerce-lookup-bar'
import { CommerceReferenceLabel } from '../../../_components/commerce-reference-label'
import { findByCommerceLookup, matchesCommerceLookup } from '@/lib/commerce-search'
import { createClient } from '@/lib/supabase/client'
import {
  getMyOrders,
  PortalAuthError,
  type TokenGetter,
} from '@/lib/api'
import { Button, StatCard } from '@/components/ui'
import { PaymentStatusBadge } from '@/components/payment-status-badge'
import { formatMoney } from '@/lib/format'
import type { Order, OrderStatus } from '@/lib/types'
import type { PortalRole } from '@/lib/portal-permissions'
import OrderDetailPanel from './order-detail-panel'
import NewOrderDialog from './new-order-dialog'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function fmt(amount: number, currency?: string) {
  return formatMoney(amount, currency || 'ZAR')
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-info-soft text-info',
  processing: 'bg-accent-soft text-accent-text',
  shipped: 'bg-accent-soft text-accent',
  delivered: 'bg-success-soft text-success',
  cancelled: 'bg-surface-2 text-ink-3',
}

const FILTER_TABS: Array<{ label: string; value: OrderStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'confirmed' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
]

function fulfillmentLabel(order: Order): string {
  if (order.status === 'pending' && order.payment_status === 'pending') {
    return 'Awaiting payment'
  }
  return STATUS_LABELS[order.status]
}

function OrderRow({
  order,
  onSelect,
}: {
  order: Order
  onSelect: (order: Order) => void
}) {
  return (
    <tr
      className="hover:bg-surface-2 transition-colors cursor-pointer"
      onClick={() => onSelect(order)}
    >
      <td className="px-4 py-3">
        <ChevronRight size={13} className="text-ink-3" />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <CommerceReferenceLabel id={order.id} className="block text-[10px] text-ink-3" />
          {order.source === 'manual' && (
            <span className="rounded bg-surface-2 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-3">
              Manual
            </span>
          )}
        </div>
        <p className="mt-0.5 font-medium text-ink">{order.customer_name ?? '—'}</p>
        <p className="text-xs text-ink-3">{order.customer_phone || '—'}</p>
      </td>
      <td className="px-4 py-3 text-ink-2 hidden sm:table-cell text-xs">
        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
      </td>
      <td className="px-4 py-3 text-right font-medium text-ink">
        {fmt(order.total_amount, order.currency)}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_COLORS[order.status]}`}>
            {fulfillmentLabel(order)}
          </span>
          <PaymentStatusBadge status={order.payment_status} />
        </div>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        {order.assigned_member ? (
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-on-solid"
              style={{ backgroundColor: order.assigned_member.avatar_color ?? '#6b7280' }}
            >
              {order.assigned_member.name.trim().split(/\s+/).filter(Boolean).map((p, i, arr) =>
                i === 0 || i === arr.length - 1 ? p[0] : ''
              ).join('').toUpperCase().slice(0, 2)}
            </div>
            <span className="text-xs text-ink-2 truncate max-w-15">{order.assigned_member.name}</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium text-ink-3">
              {order.assigned_member.role_label ?? (order.assigned_member.role.charAt(0).toUpperCase() + order.assigned_member.role.slice(1))}
            </span>
          </div>
        ) : (
          <span className="text-xs text-ink-3">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-xs text-ink-3 hidden md:table-cell">
        {new Date(order.created_at).toLocaleDateString('en-ZA', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </td>
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        {order.payment_link && (
          <a
            href={order.payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink-2 transition-colors"
            title="Payment link"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </td>
    </tr>
  )
}

export default function OrdersView({ role }: { role: PortalRole }) {
  const canEdit = role === 'owner' || role === 'manager'
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [newOrderOpen, setNewOrderOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyOrders(getFreshToken)
      setOrders(data)
    } catch (err) {
      if (err instanceof PortalAuthError && err.status === 403) {
        setError('E-Commerce addon is not enabled. Enable it from your Subscription page.')
      } else {
        setError('Failed to load orders.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ref = searchParams.get('ref')?.trim()
    if (ref) {
      setSearch(ref)
      setActiveTab('all')
    }
  }, [searchParams])

  useEffect(() => {
    if (!orders.length || selectedOrder) return
    const ref = searchParams.get('ref')?.trim()
    if (!ref) return
    const match = findByCommerceLookup(orders, ref)
    if (match) setSelectedOrder(match)
  }, [orders, searchParams, selectedOrder])

  const handleOrderUpdate = useCallback((updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
    setSelectedOrder((prev) => (prev?.id === updated.id ? updated : prev))
  }, [])

  const handleOrderCreated = useCallback((created: Order) => {
    setOrders((prev) => [created, ...prev])
    setSelectedOrder(created)
  }, [])

  const filtered = useMemo(() => {
    let list = activeTab === 'all' ? orders : orders.filter((o) => o.status === activeTab)
    if (search.trim()) {
      list = list.filter((o) => matchesCommerceLookup(o, search))
    }
    return list
  }, [orders, activeTab, search])

  const stats = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 6)
    const currency = orders.find((o) => o.currency)?.currency ?? 'ZAR'
    let today = 0
    let weekRevenue = 0
    let awaitingPayment = 0
    for (const o of orders) {
      const created = new Date(o.created_at)
      if (created >= todayStart) today++
      if (
        created >= weekStart &&
        o.status !== 'cancelled' &&
        (o.payment_status === 'paid' || o.payment_status === 'not_required')
      ) {
        weekRevenue += o.total_amount
      }
      if (o.payment_status === 'pending' && o.status !== 'cancelled') awaitingPayment++
    }
    return { today, weekRevenue, awaitingPayment, currency }
  }, [orders])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-ink-3" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-danger">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          canEdit={canEdit}
          token={getFreshToken}
          onClose={() => setSelectedOrder(null)}
          onUpdate={handleOrderUpdate}
        />
      )}
      {newOrderOpen && (
        <NewOrderDialog
          open={newOrderOpen}
          token={getFreshToken}
          onClose={() => setNewOrderOpen(false)}
          onCreated={handleOrderCreated}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Orders</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            Look up orders by the reference number customers show at pickup.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setNewOrderOpen(true)} className="shrink-0">
            <Plus size={15} /> New order
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Orders today" value={stats.today} />
        <StatCard
          label="Revenue this week"
          value={fmt(stats.weekRevenue, stats.currency)}
          caption="Paid and no-payment orders, last 7 days"
        />
        <StatCard label="Awaiting payment" value={stats.awaitingPayment} />
      </div>

      <CommerceLookupBar value={search} onChange={setSearch} />

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-line overflow-x-auto">
        {FILTER_TABS.map((tab) => {
          const count = tab.value === 'all'
            ? orders.length
            : orders.filter((o) => o.status === tab.value).length
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.value
                  ? 'border-accent text-accent-text'
                  : 'border-transparent text-ink-2 hover:text-ink-2'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeTab === tab.value ? 'bg-accent text-on-solid' : 'bg-surface-2 text-ink-2'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Orders table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line py-16 text-center">
          <ShoppingBag size={32} className="mb-3 text-ink-3" />
          <p className="text-sm font-medium text-ink-2">
            {search.trim() ? 'No orders match your search' : 'No orders yet'}
          </p>
          <p className="mt-1 text-xs text-ink-3">
            {search.trim()
              ? 'Try the reference number, customer name, phone, or email.'
              : 'Orders placed via WhatsApp appear here — or create one with “New order”.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-2">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-2 hidden sm:table-cell">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-2">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-2">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-ink-2 hidden lg:table-cell">Assigned</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-ink-2 hidden md:table-cell">Date</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onSelect={setSelectedOrder}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
