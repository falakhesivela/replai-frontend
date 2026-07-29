'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ExternalLink,
  Loader2,
  Mail,
  MessageSquare,
  Package,
  Pencil,
  Phone,
  Send,
  StickyNote,
  User,
  X,
} from 'lucide-react'
import {
  assignMyOrder,
  getBookableMembers,
  getMyOrderEvents,
  getMyProducts,
  sendReply,
  syncMyOrderPayment,
  updateMyOrder,
  updateMyOrderStatus,
  type TokenGetter,
} from '@/lib/api'
import { useToast } from '@/components/toast'
import { PaymentStatusBadge } from '@/components/payment-status-badge'
import { formatCommerceReference } from '@/lib/commerce-search'
import { formatMoney } from '@/lib/format'
import type { BookableMember, Order, OrderEvent, OrderStatus, Product } from '@/lib/types'
import { OrderItemsEditor, itemsToDrafts, type DraftItem } from './order-items-editor'

// ── Timeline ────────────────────────────────────────────────────────────────

function eventLabel(ev: OrderEvent): string {
  const d = ev.data ?? {}
  switch (ev.type) {
    case 'created':
      return d.source === 'manual' ? 'Order created in portal' : 'Order placed'
    case 'status_changed':
      return `Status → ${String(d.to ?? '')}${d.actor_name ? ` by ${d.actor_name}` : ''}`
    case 'payment_received':
      return 'Payment received'
    case 'items_edited':
      return `Items edited${d.actor_name ? ` by ${d.actor_name}` : ''}`
    case 'assigned':
      return d.member_name ? `Assigned to ${d.member_name}` : 'Unassigned'
    case 'note':
      return 'Note updated'
    default:
      return ev.type
  }
}

function Timeline({ token, orderId, refreshKey }: { token: TokenGetter; orderId: string; refreshKey: number }) {
  const [events, setEvents] = useState<OrderEvent[]>([])

  useEffect(() => {
    getMyOrderEvents(token, orderId).then(setEvents).catch(() => {})
  }, [token, orderId, refreshKey])

  if (events.length === 0) return null

  return (
    <div className="space-y-2">
      <SectionHeading>Timeline</SectionHeading>
      <ol className="space-y-2.5">
        {events.map((ev) => (
          <li key={ev.id} className="flex gap-2.5">
            <div className="mt-1 flex flex-col items-center">
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink-2">{eventLabel(ev)}</p>
              <p className="text-[10px] text-ink-3">
                {new Date(ev.created_at).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Items can be edited only on unpaid pending/confirmed orders (mirrors the backend). */
function canEditItems(order: Order): boolean {
  return (
    (order.status === 'pending' || order.status === 'confirmed') &&
    order.payment_status !== 'paid'
  )
}

// ── Status badge + selector ───────────────────────────────────────────────────

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
  confirmed: 'bg-info-soft text-info ring-1 ring-info/25',
  processing: 'bg-accent-soft text-accent-text ring-1 ring-accent/25',
  shipped: 'bg-accent-soft text-accent ring-1 ring-accent/20',
  delivered: 'bg-success-soft text-success ring-1 ring-success/25',
  cancelled: 'bg-surface-2 text-ink-3',
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
  return <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">{children}</p>
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
          className="w-full resize-none rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
        {sent && <p className="rounded-md bg-success-soft px-3 py-2 text-xs text-success">Message sent.</p>}
        <button
          type="submit"
          disabled={!message.trim() || sending}
          className="flex items-center gap-1.5 rounded-lg bg-accent shadow-sm shadow-accent/25 px-4 py-2 text-xs font-medium text-on-solid hover:bg-accent-hover transition-colors disabled:opacity-40"
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
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-on-solid"
              style={{ backgroundColor: order.assigned_member.avatar_color ?? '#6b7280' }}
            >
              {memberInitials(order.assigned_member.name)}
            </div>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-2">
              {order.assigned_member.role_label ?? (order.assigned_member.role.charAt(0).toUpperCase() + order.assigned_member.role.slice(1))}
            </span>
          </>
        )}
        <select
          value={order.assigned_to ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={assigning}
          className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm text-ink-2 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-40"
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.role_label ?? (m.role.charAt(0).toUpperCase() + m.role.slice(1))})
            </option>
          ))}
        </select>
        {assigning && <Loader2 size={14} className="animate-spin text-ink-3 shrink-0" />}
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
  const { toast } = useToast()
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [syncingPayment, setSyncingPayment] = useState(false)
  const [paymentSyncError, setPaymentSyncError] = useState<string | null>(null)

  // Notes
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(order.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)

  // Tracking number
  const [trackingDraft, setTrackingDraft] = useState(order.tracking_number ?? '')
  const [savingTracking, setSavingTracking] = useState(false)

  // Item editing
  const [products, setProducts] = useState<Product[]>([])
  const [editingItems, setEditingItems] = useState(false)
  const [itemDrafts, setItemDrafts] = useState<DraftItem[]>([])
  const [savingItems, setSavingItems] = useState(false)

  const money = (n: number) => formatMoney(n, order.currency)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setStatusError(null)
    setPaymentSyncError(null)
    setEditingNotes(false)
    setNotesDraft(order.notes ?? '')
    setEditingItems(false)
    setTrackingDraft(order.tracking_number ?? '')
  }, [order.id, order.notes, order.tracking_number])

  useEffect(() => {
    if (canEdit) getMyProducts(token).then(setProducts).catch(() => {})
  }, [canEdit, token])

  async function handleSaveTracking() {
    setSavingTracking(true)
    try {
      const updated = await updateMyOrder(token, order.id, {
        tracking_number: trackingDraft.trim() || null,
      })
      onUpdate(updated)
      toast.success('Tracking number saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save tracking number')
    } finally {
      setSavingTracking(false)
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true)
    try {
      const updated = await updateMyOrder(token, order.id, { notes: notesDraft.trim() || null })
      onUpdate(updated)
      setEditingNotes(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  function startEditItems() {
    setItemDrafts(itemsToDrafts(order.items, products))
    setEditingItems(true)
  }

  async function handleSaveItems() {
    if (itemDrafts.length === 0) {
      toast.error('An order needs at least one item')
      return
    }
    setSavingItems(true)
    try {
      const updated = await updateMyOrder(token, order.id, {
        items: itemDrafts.map((it) =>
          it.product_id
            ? { product_id: it.product_id, quantity: it.quantity }
            : { name: it.name, price: it.price, quantity: it.quantity }
        ),
      })
      onUpdate(updated)
      setEditingItems(false)
      if (updated.payment_link_regenerated) {
        toast.info('Total changed — the payment link was regenerated')
      } else {
        toast.success('Order updated')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update items')
    } finally {
      setSavingItems(false)
    }
  }

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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-2xl">

        {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Order</h2>
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-2">
                {formatCommerceReference(order.id)}
              </p>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink-2 transition-colors"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Order summary hero */}
          <div className="border-b border-line bg-surface-2 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-ink-2">
                <Package size={14} strokeWidth={1.75} />
                <span className="text-xs font-medium">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-lg font-semibold text-ink">{money(order.total_amount)}</span>
            </div>
            <p className="text-xs text-ink-2">Ask the customer for this reference at pickup</p>
          </div>

          <div className="p-5 space-y-6">

            {/* Customer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <SectionHeading>Customer</SectionHeading>
                {order.customer_phone && (
                  <Link
                    href={`/portal/conversations?phone=${encodeURIComponent(order.customer_phone)}`}
                    className="flex items-center gap-1 text-[10px] text-info hover:text-info transition-colors"
                  >
                    <MessageSquare size={10} /> Open conversation
                  </Link>
                )}
              </div>
              {order.customer_name && (
                <div className="flex items-center gap-2.5">
                  <User size={13} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                  <span className="text-sm text-ink">{order.customer_name}</span>
                </div>
              )}
              {order.customer_phone && (
                <div className="flex items-center gap-2.5">
                  <Phone size={13} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                  <span className="font-mono text-sm text-ink-2">{order.customer_phone}</span>
                </div>
              )}
              {order.customer_email && (
                <div className="flex items-center gap-2.5">
                  <Mail size={13} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                  <span className="text-sm text-ink-2">{order.customer_email}</span>
                </div>
              )}
            </div>

            {/* Order items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <SectionHeading>Items</SectionHeading>
                {canEdit && canEditItems(order) && !editingItems && (
                  <button
                    onClick={startEditItems}
                    className="flex items-center gap-1 text-[10px] text-info hover:text-info transition-colors"
                  >
                    <Pencil size={10} /> Edit items
                  </button>
                )}
              </div>

              {editingItems ? (
                <div className="space-y-3">
                  <OrderItemsEditor
                    products={products}
                    items={itemDrafts}
                    currency={order.currency ?? 'ZAR'}
                    onChange={setItemDrafts}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveItems}
                      disabled={savingItems}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-on-solid hover:bg-accent-hover transition-colors disabled:opacity-40"
                    >
                      {savingItems && <Loader2 size={12} className="animate-spin" />}
                      Save items
                    </button>
                    <button
                      onClick={() => setEditingItems(false)}
                      disabled={savingItems}
                      className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink-2 hover:bg-surface-2"
                    >
                      Cancel
                    </button>
                  </div>
                  {order.payment_status === 'pending' && order.payment_reference && (
                    <p className="text-[10px] text-ink-3">
                      Changing the total will regenerate the customer&apos;s payment link.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-line overflow-hidden">
                  {order.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2.5 border-b border-line/60 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink truncate">{item.name}</p>
                        <p className="text-xs text-ink-3">
                          {money(item.price)} × {item.quantity}
                        </p>
                      </div>
                      <span className="ml-4 shrink-0 text-sm font-medium text-ink">
                        {money(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                  {/* Discount + total rows */}
                  {(order.discount_amount ?? 0) > 0 && (
                    <div className="flex items-center justify-between border-t border-line px-3 py-2">
                      <span className="text-xs text-ink-3">Discount</span>
                      <span className="text-xs text-ink-2">−{money(order.discount_amount!)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-line bg-surface-2 px-3 py-2.5">
                    <span className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Total</span>
                    <span className="text-sm font-bold text-ink">{money(order.total_amount)}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <PaymentStatusBadge status={order.payment_status} />
                {order.payment_link && (
                  <a
                    href={order.payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-info hover:text-info transition-colors"
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
                      className="text-xs text-warning hover:text-warning disabled:opacity-50"
                    >
                      {syncingPayment ? 'Checking Paystack…' : 'Refresh payment status'}
                    </button>
                  )}
              </div>
              {paymentSyncError && (
                <p className="text-xs text-danger">{paymentSyncError}</p>
              )}
            </div>

            {/* Fulfillment */}
            {(order.fulfillment_method && order.fulfillment_method !== 'none') ||
            order.tracking_number ||
            (canEdit && (order.status === 'processing' || order.status === 'shipped')) ? (
              <div className="space-y-2">
                <SectionHeading>Fulfillment</SectionHeading>
                {order.fulfillment_method && order.fulfillment_method !== 'none' && (
                  <p className="text-sm capitalize text-ink">{order.fulfillment_method}</p>
                )}
                {order.delivery_address && (
                  <p className="whitespace-pre-wrap text-sm text-ink-2">{order.delivery_address}</p>
                )}
                {canEdit && (order.status === 'processing' || order.status === 'shipped') ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={trackingDraft}
                      onChange={(e) => setTrackingDraft(e.target.value)}
                      placeholder="Tracking number"
                      className="flex-1 rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <button
                      onClick={handleSaveTracking}
                      disabled={savingTracking || trackingDraft.trim() === (order.tracking_number ?? '')}
                      className="rounded-lg bg-accent px-3 py-2 text-xs font-medium text-on-solid hover:bg-accent-hover transition-colors disabled:opacity-40"
                    >
                      {savingTracking ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                    </button>
                  </div>
                ) : order.tracking_number ? (
                  <p className="font-mono text-sm text-ink-2">{order.tracking_number}</p>
                ) : null}
                {canEdit && order.status === 'processing' && (
                  <p className="text-[10px] text-ink-3">
                    Set before marking as shipped — it&apos;s included in the customer&apos;s notification.
                  </p>
                )}
              </div>
            ) : null}

            {/* Notes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <SectionHeading>Notes</SectionHeading>
                {canEdit && !editingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="flex items-center gap-1 text-[10px] text-info hover:text-info transition-colors"
                  >
                    <Pencil size={10} /> {order.notes ? 'Edit' : 'Add note'}
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={3}
                    placeholder="Internal note — not shown to the customer"
                    className="w-full resize-none rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-on-solid hover:bg-accent-hover transition-colors disabled:opacity-40"
                    >
                      {savingNotes && <Loader2 size={12} className="animate-spin" />}
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingNotes(false); setNotesDraft(order.notes ?? '') }}
                      disabled={savingNotes}
                      className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink-2 hover:bg-surface-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : order.notes ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                  <StickyNote size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-3" />
                  <p className="whitespace-pre-wrap text-sm text-ink-2">{order.notes}</p>
                </div>
              ) : (
                <p className="text-xs text-ink-3">No notes.</p>
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
                            ? 'border-accent bg-accent text-on-solid'
                            : 'border-line text-ink-2 hover:bg-surface-2'
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
                    <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{statusError}</p>
                  )}
                </div>
              ) : (
                <StatusBadge status={order.status} />
              )}
            </div>

            {/* Timeline */}
            <Timeline token={token} orderId={order.id} refreshKey={new Date(order.updated_at).getTime()} />

            {/* Send message */}
            {order.customer_phone && (
              <SendMessagePanel customerPhone={order.customer_phone} token={token} />
            )}

            {/* Footer */}
            <div className="border-t border-line pt-4 space-y-1">
              <p className="text-[10px] text-ink-3">
                Placed {new Date(order.created_at).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
              {order.updated_at !== order.created_at && (
                <p className="text-[10px] text-ink-3">
                  Updated {new Date(order.updated_at).toLocaleString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
              <p className="font-mono text-[10px] text-ink-3">{order.id}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
