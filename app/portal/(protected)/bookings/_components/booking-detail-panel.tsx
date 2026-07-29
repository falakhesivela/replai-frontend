'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Scissors,
  Send,
  User,
  X,
  ExternalLink,
} from 'lucide-react'
import {
  assignMyBooking,
  getBookableMembers,
  getMyAvailableSlots,
  rescheduleMyBooking,
  sendReply,
  updateMyBookingStatus,
  type TokenGetter,
} from '@/lib/api'
import { PaymentStatusBadge } from '@/components/payment-status-badge'
import { formatBookingDetailRows, stayRangeFromBooking } from '@/lib/booking-details'
import { formatCommerceReference } from '@/lib/commerce-search'
import type { Booking, BookableMember, SchedulingMode, Slot } from '@/lib/types'
import { usePermissions } from '@/hooks/usePermissions'

type BookingStatus = Booking['status']

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDateLong(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateShort(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BookingStatus, string> = {
  reserved: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  confirmed: 'bg-success-soft text-success ring-1 ring-success/25',
  cancelled: 'bg-danger-soft text-danger ring-1 ring-danger/25',
  completed: 'bg-surface-2 text-ink-2',
  no_show: 'bg-warning-soft text-warning ring-1 ring-warning/25',
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  reserved: 'Reserved',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">{children}</p>
}

// ── Reschedule panel ──────────────────────────────────────────────────────────

function ReschedulePanel({
  booking, token, onRescheduled, onCancel,
}: {
  booking: Booking
  token: TokenGetter
  onRescheduled: (updated: Booking) => void
  onCancel: () => void
}) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>('slot')
  const [slotId, setSlotId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getMyAvailableSlots(token, booking.service_id)
      .then((res) => {
        setSchedulingMode(res.scheduling_mode)
        setSlots(res.slots)
      })
      .catch(() => setError('Failed to load available slots'))
      .finally(() => setLoading(false))
  }, [booking.service_id, token])

  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {}
    for (const s of slots) { (map[s.date_label] ??= []).push(s) }
    return map
  }, [slots])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!slotId) return
    setSubmitting(true)
    setError(null)
    try {
      onRescheduled(await rescheduleMyBooking(token, booking.id, slotId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-info/30 bg-info-soft/50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-info">
        {schedulingMode === 'date_range'
          ? 'Choose new check-in'
          : schedulingMode === 'date_only'
            ? 'Choose new date'
            : 'Choose new slot'}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <Loader2 size={13} className="animate-spin" /> Loading slots…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <select
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            required
            disabled={slots.length === 0}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          >
            <option value="">{slots.length === 0 ? 'No slots available' : 'Select a slot…'}</option>
            {Object.entries(slotsByDate).map(([label, daySlots]) => (
              <optgroup key={label} label={label}>
                {daySlots.map((s) => (
                  <option key={s.slot_id} value={s.slot_id}>{s.time_label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel}
              className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-2 hover:bg-surface-2 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!slotId || submitting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-medium text-on-solid hover:bg-accent-hover transition-colors disabled:opacity-40">
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Confirm
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Send message panel ────────────────────────────────────────────────────────

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
        <button type="submit" disabled={!message.trim() || sending}
          className="flex items-center gap-1.5 rounded-lg bg-accent shadow-sm shadow-accent/25 px-4 py-2 text-xs font-medium text-on-solid hover:bg-accent-hover transition-colors disabled:opacity-40">
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

function MemberAvatar({ name, color }: { name: string; color?: string | null }) {
  return (
    <div
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-on-solid"
      style={{ backgroundColor: color ?? '#6b7280' }}
    >
      {memberInitials(name)}
    </div>
  )
}

function AssignSection({
  booking,
  token,
  canManage,
  onUpdate,
}: {
  booking: Booking
  token: TokenGetter
  canManage: boolean
  onUpdate: (updated: Booking) => void
}) {
  const [members, setMembers] = useState<BookableMember[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getBookableMembers(token)
      .then(setMembers)
      .catch(() => setError('Failed to load team'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleAssign(memberId: string | null) {
    setBusy(true)
    setError(null)
    try {
      onUpdate(await assignMyBooking(token, booking.id, memberId))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign')
    } finally {
      setBusy(false)
    }
  }

  const current = booking.assigned_member

  return (
    <div className="space-y-2">
      <SectionHeading>Assigned to</SectionHeading>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <Loader2 size={12} className="animate-spin" /> Loading…
        </div>
      ) : canManage ? (
        <div className="space-y-2">
          <select
            value={booking.assigned_to ?? ''}
            onChange={(e) => handleAssign(e.target.value || null)}
            disabled={busy}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.role_label ?? (m.role.charAt(0).toUpperCase() + m.role.slice(1))})
              </option>
            ))}
          </select>
          {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
        </div>
      ) : current ? (
        <div className="flex items-center gap-2">
          <MemberAvatar name={current.name} color={current.avatar_color} />
          <span className="text-sm text-ink-2">{current.name}</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-2">
            {current.role_label ?? (current.role.charAt(0).toUpperCase() + current.role.slice(1))}
          </span>
        </div>
      ) : (
        <p className="text-sm text-ink-3">Unassigned</p>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function BookingDetailPanel({
  booking,
  allBookings,
  token,
  onClose,
  onUpdate,
}: {
  booking: Booking
  allBookings: Booking[]
  token: TokenGetter
  onClose: () => void
  onUpdate: (updated: Booking) => void
}) {
  const { can } = usePermissions()
  const canCancel = can('manage_bookings')
  const canManage = can('manage_team')
  const [busy, setBusy] = useState<BookingStatus | null>(null)
  const [showReschedule, setShowReschedule] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const otherBookings = useMemo(
    () => allBookings.filter((b) => b.customer_phone === booking.customer_phone && b.id !== booking.id),
    [allBookings, booking.customer_phone, booking.id]
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setShowReschedule(false)
    setActionError(null)
  }, [booking.id])

  async function applyStatus(status: BookingStatus) {
    setBusy(status)
    setActionError(null)
    try {
      onUpdate(await updateMyBookingStatus(token, booking.id, status))
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  const isActive = booking.status === 'confirmed'
  const detailRows = formatBookingDetailRows(booking.booking_details)
  const stayRange = stayRangeFromBooking(booking.booking_date, booking.booking_details)
  const isAllDay =
    booking.booking_time.startsWith('12:00') && !stayRange

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Booking</h2>
              <p className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-2">
                {formatCommerceReference(booking.id)}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
          <button onClick={onClose}
            className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink-2 transition-colors">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Appointment hero */}
          <div className="border-b border-line bg-surface-2 px-5 py-4 space-y-2">
            {stayRange ? (
              <>
                <div className="flex items-center gap-2.5 text-sm font-medium text-ink">
                  <Calendar size={14} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                  Check-in {stayRange.checkInLabel}
                </div>
                <div className="flex items-center gap-2.5 text-sm text-ink-2">
                  <Calendar size={14} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                  Check-out {stayRange.checkOutLabel}
                </div>
              </>
            ) : isAllDay ? (
              <div className="flex items-center gap-2.5 text-sm font-medium text-ink">
                <Calendar size={14} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                {formatDateLong(booking.booking_date)} · All day
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5 text-sm font-medium text-ink">
                  <Calendar size={14} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                  {formatDateLong(booking.booking_date)}
                </div>
                <div className="flex items-center gap-2.5 text-sm text-ink-2">
                  <Clock size={14} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                  {formatTime(booking.booking_time)}
                  {booking.services && (
                    <span className="text-xs text-ink-3">· {booking.services.duration_minutes} min</span>
                  )}
                </div>
              </>
            )}
            {booking.services && (
              <div className="flex items-center gap-2.5 text-sm text-ink-2">
                <Scissors size={14} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                {booking.services.name}
              </div>
            )}
            {detailRows.map((row) => (
              <div key={row.label} className="flex items-center gap-2.5 text-sm text-ink-2">
                <User size={14} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                <span>
                  <span className="text-ink-2">{row.label}: </span>
                  {row.value}
                </span>
              </div>
            ))}
            <p className="text-xs text-ink-2">Ask the customer for this reference when they arrive</p>
          </div>

          <div className="p-5 space-y-6">

            {/* Customer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <SectionHeading>Customer</SectionHeading>
                <Link
                  href={`/portal/conversations?phone=${encodeURIComponent(booking.customer_phone)}`}
                  className="flex items-center gap-1 text-[10px] text-info hover:text-info transition-colors"
                >
                  <MessageSquare size={10} /> Open conversation
                </Link>
              </div>
              <div className="flex items-center gap-2.5">
                <User size={13} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                <span className="text-sm text-ink">{booking.customer_name}</span>
                {otherBookings.length > 0 && (
                  <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-ink-2">
                    {otherBookings.length + 1} bookings total
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <Phone size={13} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                <span className="font-mono text-sm text-ink-2">{booking.customer_phone}</span>
              </div>
              {booking.customer_email && (
                <div className="flex items-center gap-2.5">
                  <Mail size={13} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                  <span className="text-sm text-ink-2">{booking.customer_email}</span>
                </div>
              )}
            </div>

            {(booking.payment_status && booking.payment_status !== 'not_required') ||
            booking.payment_link ||
            (booking.total_amount != null && booking.total_amount > 0) ? (
              <div className="space-y-2">
                <SectionHeading>Payment</SectionHeading>
                {booking.total_amount != null && booking.total_amount > 0 && (
                  <p className="text-sm font-medium text-ink">
                    {new Intl.NumberFormat('en-ZA', {
                      style: 'currency',
                      currency: booking.currency ?? 'ZAR',
                    }).format(booking.total_amount)}
                  </p>
                )}
                {!(booking.status === 'cancelled' && booking.payment_status !== 'paid') && (
                  <PaymentStatusBadge status={booking.payment_status} />
                )}
                {booking.payment_link && booking.status !== 'cancelled' && (
                  <a
                    href={booking.payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-info hover:text-info transition-colors"
                  >
                    <ExternalLink size={12} /> View payment link
                  </a>
                )}
              </div>
            ) : null}

            {/* Other bookings from this customer */}
            {otherBookings.length > 0 && (
              <div className="space-y-2">
                <SectionHeading>Other bookings</SectionHeading>
                <div className="space-y-1">
                  {otherBookings.slice(0, 4).map((b) => (
                    <div key={b.id} className="flex items-center justify-between rounded-md border border-line px-3 py-2">
                      <div>
                        <p className="text-xs text-ink-2">
                          {formatDateShort(b.booking_date)} · {formatTime(b.booking_time)}
                        </p>
                        {b.services && <p className="text-[10px] text-ink-3">{b.services.name}</p>}
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assignment */}
            <AssignSection
              booking={booking}
              token={token}
              canManage={canManage}
              onUpdate={onUpdate}
            />

            {/* Actions */}
            {isActive && (
              <div className="space-y-2">
                <SectionHeading>Actions</SectionHeading>
                {actionError && (
                  <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{actionError}</p>
                )}
                {!showReschedule ? (
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setShowReschedule(true)}
                      className="flex items-center justify-center gap-1.5 rounded-md border border-info/30 bg-info-soft px-4 py-2 text-xs font-medium text-info hover:bg-accent-soft transition-colors">
                      <Calendar size={12} strokeWidth={2} /> Reschedule
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => applyStatus('completed')} disabled={busy !== null}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-line px-4 py-2 text-xs font-medium text-ink-2 hover:bg-surface-2 transition-colors disabled:opacity-40">
                        {busy === 'completed' && <Loader2 size={12} className="animate-spin" />}
                        Mark completed
                      </button>
                      <button onClick={() => applyStatus('no_show')} disabled={busy !== null}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-warning/30 bg-warning-soft px-4 py-2 text-xs font-medium text-warning hover:bg-warning-soft transition-colors disabled:opacity-40">
                        {busy === 'no_show' && <Loader2 size={12} className="animate-spin" />}
                        No-show
                      </button>
                    </div>
                    {canCancel && (
                      <button onClick={() => applyStatus('cancelled')} disabled={busy !== null}
                        className="flex items-center justify-center gap-1.5 rounded-md border border-danger/30 bg-danger-soft px-4 py-2 text-xs font-medium text-danger hover:bg-danger-soft transition-colors disabled:opacity-40">
                        {busy === 'cancelled' && <Loader2 size={12} className="animate-spin" />}
                        Cancel booking
                      </button>
                    )}
                  </div>
                ) : (
                  <ReschedulePanel
                    booking={booking}
                    token={token}
                    onRescheduled={(updated) => { onUpdate(updated); setShowReschedule(false) }}
                    onCancel={() => setShowReschedule(false)}
                  />
                )}
              </div>
            )}

            {/* Send message */}
            <SendMessagePanel customerPhone={booking.customer_phone} token={token} />

            {/* Footer */}
            <div className="border-t border-line pt-4 space-y-1">
              <p className="text-[10px] text-ink-3">
                Booked {new Date(booking.created_at).toLocaleString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
              <p className="font-mono text-[10px] text-ink-3">{booking.id}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
