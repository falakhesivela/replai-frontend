'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  Package,
  Phone,
  Send,
  User,
  X,
} from 'lucide-react'
import {
  assignMyOrder,
  getBookableMembers,
  sendReply,
  syncMyOrderPayment,
  updateMyOrderStatus,
  type TokenGetter,
} from '@/lib/api'
import { PaymentStatusBadge } from '@/components/payment-status-badge'
import { formatCommerceReference } from '@/lib/commerce-search'
import type { BookableMember, Order, OrderStatus } from '@/lib/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

// ── Status badge + selector ───────────────────────────────────────────────────

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
  confirmed: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  processing: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  shipped: 'bg-accent-soft text-accent ring-1 ring-accent/20',
  delivered: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  cancelled: 'bg-gray-100 text-gray-400',
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const ALL_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{children}</p>
}

// ── Send message ──────────────────────────────────────────────────────────────

function SendMessagePanel({ customerPhone, token }: { customerPhone: string; token: TokenGetter }) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSending(true)
    setError(null)
    try {
      await sendReply(token, customerPhone, message.trim())
      setMessage('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send'
      setError(msg.includes('404') ? 'No active conversation with this customer yet.' : msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-2">
      <SectionHeading>Send Message</SectionHeading>
      <form onSubmit={handleSend} className="space-y-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a WhatsApp message…"
          rows={3}
          className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        {sent && <p className="rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">Message sent.</p>}
        <button
          type="submit"
          disabled={!message.trim() || sending}
          className="flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-xs font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-40"
        >
          {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} strokeWidth={2} />}
          Send
        </button>
      </form>
    </div>
  )
}

// ── Assign section ────────────────────────────────────────────────────────────

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function AssignSection({
  order,
  token,
  onUpdate,
}: {
  order: Order
  token: TokenGetter
  onUpdate: (updated: Order) => void
}) {
  const [members, setMembers] = useState<BookableMember[]>([])
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    getBookableMembers(token).then(setMembers).catch(() => {})
  }, [token])

  async function handleChange(memberId: string) {
    setAssigning(true)
    try {
      const updated = await assignMyOrder(token, order.id, memberId || null)
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to assign order:', err)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="space-y-2">
      <SectionHeading>Assigned to</SectionHeading>
      <div className="flex items-center gap-2">
        {order.assigned_member && (
          <>
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: order.assigned_member.avatar_color ?? '#6b7280' }}
            >
              {memberInitials(order.assigned_member.name)}
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              {order.assigned_member.role_label ?? (order.assigned_member.role.charAt(0).toUpperCase() + order.assigned_member.role.slice(1))}
            </span>
          </>
        )}
        <select
          value={order.assigned_to ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={assigning}
          className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-40"
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.role_label ?? (m.role.charAt(0).toUpperCase() + m.role.slice(1))})
            </option>
          ))}
        </select>
        {assigning && <Loader2 size={14} className="animate-spin text-gray-400 shrink-0" />}
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function OrderDetailPanel({
  order,
  canEdit,
  token,
  onClose,
  onUpdate,
}: {
  order: Order
  canEdit: boolean
  token: TokenGetter
  onClose: () => void
  onUpdate: (updated: Order) => void
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [syncingPayment, setSyncingPayment] = useState(false)
  const [paymentSyncError, setPaymentSyncError] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setStatusError(null)
    setPaymentSyncError(null)
  }, [order.id])

  async function handleSyncPayment() {
    setSyncingPayment(true)
    setPaymentSyncError(null)
    try {
      onUpdate(await syncMyOrderPayment(token, order.id))
    } catch (err: unknown) {
      setPaymentSyncError(err instanceof Error ? err.message : 'Could not sync payment')
    } finally {
      setSyncingPayment(false)
    }
  }

  async function handleStatusChange(status: OrderStatus) {
    if (status === order.status) return
    setUpdatingStatus(true)
    setStatusError(null)
    try {
      onUpdate(await updateMyOrderStatus(token, order.id, status))
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">

        {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Order</h2>
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-gray-500">
                {formatCommerceReference(order.id)}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Order summary hero */}
          <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-500">
                <Package size={14} strokeWidth={1.75} />
                <span className="text-xs font-medium">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-lg font-semibold text-gray-900">{fmt(order.total_amount)}</span>
            </div>
            <p className="text-xs text-gray-500">Ask the customer for this reference at pickup</p>
          </div>

          <div className="p-5 space-y-6">

            {/* Customer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <SectionHeading>Customer</SectionHeading>
                <Link
                  href={`/portal/conversations?phone=${encodeURIComponent(order.customer_phone)}`}
                  className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <MessageSquare size={10} /> Open conversation
                </Link>
              </div>
              {order.customer_name && (
                <div className="flex items-center gap-2.5">
                  <User size={13} strokeWidth={1.75} className="shrink-0 text-gray-400" />
                  <span className="text-sm text-gray-800">{order.customer_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Phone size={13} strokeWidth={1.75} className="shrink-0 text-gray-400" />
                <span className="font-mono text-sm text-gray-700">{order.customer_phone}</span>
              </div>
              {order.customer_email && (
                <div className="flex items-center gap-2.5">
                  <Mail size={13} strokeWidth={1.75} className="shrink-0 text-gray-400" />
                  <span className="text-sm text-gray-700">{order.customer_email}</span>
                </div>
              )}
            </div>

            {/* Order items */}
            <div className="space-y-2">
              <SectionHeading>Items</SectionHeading>
              <div className="rounded-lg border border-gray-100 overflow-hidden">
                {order.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2.5 border-b border-gray-50 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {fmt(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <span className="ml-4 shrink-0 text-sm font-medium text-gray-900">
                      {fmt(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
                {/* Total row */}
                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2.5">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total</span>
                  <span className="text-sm font-bold text-gray-900">{fmt(order.total_amount)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <PaymentStatusBadge status={order.payment_status} />
                {order.payment_link && (
                  <a
                    href={order.payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <ExternalLink size={12} /> View payment link
                  </a>
                )}
                {canEdit &&
                  order.payment_status === 'pending' &&
                  order.payment_reference && (
                    <button
                      type="button"
                      onClick={handleSyncPayment}
                      disabled={syncingPayment}
                      className="text-xs text-amber-700 hover:text-amber-900 disabled:opacity-50"
                    >
                      {syncingPayment ? 'Checking Paystack…' : 'Refresh payment status'}
                    </button>
                  )}
              </div>
              {paymentSyncError && (
                <p className="text-xs text-red-600">{paymentSyncError}</p>
              )}
            </div>

            {/* Assign */}
            {canEdit && (
              <AssignSection order={order} token={token} onUpdate={onUpdate} />
            )}

            {/* Status */}
            <div className="space-y-2">
              <SectionHeading>Status</SectionHeading>
              {canEdit ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {ALL_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        disabled={updatingStatus}
                        className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                          order.status === s
                            ? 'border-accent bg-brand text-white'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {updatingStatus && order.status !== s ? (
                          <Loader2 size={11} className="mx-auto animate-spin" />
                        ) : (
                          STATUS_LABELS[s]
                        )}
                      </button>
                    ))}
                  </div>
                  {statusError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{statusError}</p>
                  )}
                </div>
              ) : (
                <StatusBadge status={order.status} />
              )}
            </div>

            {/* Send message */}
            <SendMessagePanel customerPhone={order.customer_phone} token={token} />

            {/* Footer */}
            <div className="border-t border-gray-100 pt-4 space-y-1">
              <p className="text-[10px] text-gray-400">
                Placed {new Date(order.created_at).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
              {order.updated_at !== order.created_at && (
                <p className="text-[10px] text-gray-400">
                  Updated {new Date(order.updated_at).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
              <p className="font-mono text-[10px] text-gray-300">{order.id}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
