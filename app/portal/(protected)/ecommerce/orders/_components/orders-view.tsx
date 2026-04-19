'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, ExternalLink, Loader2, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getMyOrders,
  PortalAuthError,
  type TokenGetter,
} from '@/lib/api'
import type { Order, OrderStatus } from '@/lib/types'
import type { PortalRole } from '@/lib/portal-permissions'
import OrderDetailPanel from './order-detail-panel'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
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
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-purple-100 text-purple-700',
  shipped: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-400',
}

const ALL_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled',
]

const FILTER_TABS: Array<{ label: string; value: OrderStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Active', value: 'confirmed' },
  { label: 'Shipped', value: 'shipped' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
]

function OrderRow({
  order,
  onSelect,
}: {
  order: Order
  onSelect: (order: Order) => void
}) {
  return (
    <tr
      className="hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onSelect(order)}
    >
      <td className="px-4 py-3">
        <ChevronRight size={13} className="text-gray-300" />
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{order.customer_name ?? '—'}</p>
        <p className="text-xs text-gray-400">{order.customer_phone}</p>
      </td>
      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell text-xs">
        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
      </td>
      <td className="px-4 py-3 text-right font-medium text-gray-900">
        {fmt(order.total_amount)}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_COLORS[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        {order.assigned_member ? (
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: order.assigned_member.avatar_color ?? '#6b7280' }}
            >
              {order.assigned_member.name.trim().split(/\s+/).filter(Boolean).map((p, i, arr) =>
                i === 0 || i === arr.length - 1 ? p[0] : ''
              ).join('').toUpperCase().slice(0, 2)}
            </div>
            <span className="text-xs text-gray-500 truncate max-w-[60px]">{order.assigned_member.name}</span>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-400">
              {order.assigned_member.role_label ?? (order.assigned_member.role.charAt(0).toUpperCase() + order.assigned_member.role.slice(1))}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-xs text-gray-400 hidden md:table-cell">
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
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
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

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

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

  const handleOrderUpdate = useCallback((updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
    setSelectedOrder((prev) => (prev?.id === updated.id ? updated : prev))
  }, [])

  const filtered = activeTab === 'all'
    ? orders
    : orders.filter((o) => o.status === activeTab)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          canEdit={canEdit}
          token={getFreshToken}
          onClose={() => setSelectedOrder(null)}
          onUpdate={handleOrderUpdate}
        />
      )}
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customer orders placed via WhatsApp.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
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
                  ? 'border-[#3D6BF8] text-[#1E0B6F]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeTab === tab.value ? 'bg-[#1E0B6F] text-white' : 'bg-gray-100 text-gray-500'
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <ShoppingBag size={32} className="mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No orders yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Orders placed by customers via WhatsApp will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden lg:table-cell">Assigned</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 hidden md:table-cell">Date</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
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
