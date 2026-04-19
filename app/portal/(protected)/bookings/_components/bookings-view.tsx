'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Calendar,
  ChevronRight,
  Clock,
  List,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  createMyBooking,
  getMyAvailableSlots,
  getMyServices,
  updateMyBookingStatus,
  type TokenGetter,
} from '@/lib/api'
import type { Booking, Service, Slot } from '@/lib/types'
import { usePermissions } from '@/hooks/usePermissions'
import BookingDetailPanel from './booking-detail-panel'

// Token getter that pulls a fresh Supabase access token on every call so we
// don't ship an expired JWT to the backend after the page has been open for a
// while.
const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'upcoming' | 'today' | 'past' | 'all'
type ViewMode = 'list' | 'calendar'
type BookingStatus = Booking['status']

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function thisWeekBounds(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  cancelled: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  completed: 'bg-gray-100 text-gray-500',
  no_show: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Actions dropdown ──────────────────────────────────────────────────────────

const ACTIONS: { label: string; status: BookingStatus; danger?: boolean }[] = [
  { label: 'Mark as completed', status: 'completed' },
  { label: 'Mark as no-show', status: 'no_show' },
  { label: 'Cancel booking', status: 'cancelled', danger: true },
]

function ActionsDropdown({
  booking,
  onUpdate,
}: {
  booking: Booking
  onUpdate: (updated: Booking) => void
}) {
  const { can } = usePermissions()
  const canCancel = can('manage_bookings')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  async function apply(status: BookingStatus) {
    setBusy(true)
    setOpen(false)
    try {
      const updated = await updateMyBookingStatus(getFreshToken, booking.id, status)
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to update booking:', err)
    } finally {
      setBusy(false)
    }
  }

  const available = ACTIONS.filter((a) => {
    if (a.status === booking.status) return false
    if (a.status === 'cancelled' && !canCancel) return false
    return true
  })
  if (available.length === 0) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        disabled={busy}
        className="flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-40"
      >
        {busy ? (
          <Loader2 size={14} strokeWidth={2} className="animate-spin" />
        ) : (
          <MoreHorizontal size={15} strokeWidth={1.75} />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-md">
          {available.map(({ label, status, danger }) => (
            <button
              key={status}
              onClick={() => apply(status)}
              className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                danger ? 'text-red-600' : 'text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Booking row ───────────────────────────────────────────────────────────────

function BookingRow({
  booking,
  onUpdate,
  onSelect,
}: {
  booking: Booking
  onUpdate: (updated: Booking) => void
  onSelect: (booking: Booking) => void
}) {
  return (
    <tr
      className="border-t border-gray-100 hover:bg-gray-50/50 cursor-pointer transition-colors"
      onClick={() => onSelect(booking)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <ChevronRight
            size={13}
            strokeWidth={2}
            className="shrink-0 text-gray-400"
          />
          <span className="text-sm font-medium text-gray-900">{formatTime(booking.booking_time)}</span>
          <span className="text-xs text-gray-400">{formatDate(booking.booking_date)}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">{booking.customer_name}</td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {booking.services ? (
          <>
            {booking.services.name}
            <span className="ml-1.5 text-xs text-gray-400">({booking.services.duration_minutes}m)</span>
          </>
        ) : (
          <span className="italic text-gray-300">Unknown</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={booking.status} />
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        {booking.assigned_member ? (
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: booking.assigned_member.avatar_color ?? '#6b7280' }}
            >
              {booking.assigned_member.name.trim().split(/\s+/).filter(Boolean).map((p, i, arr) =>
                i === 0 || i === arr.length - 1 ? p[0] : ''
              ).join('').toUpperCase().slice(0, 2)}
            </div>
            <span className="text-xs text-gray-500 truncate max-w-[60px]">{booking.assigned_member.name}</span>
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-400">
              {booking.assigned_member.role_label ?? (booking.assigned_member.role.charAt(0).toUpperCase() + booking.assigned_member.role.slice(1))}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <ActionsDropdown booking={booking} onUpdate={onUpdate} />
      </td>
    </tr>
  )
}

// ── Stats row ─────────────────────────────────────────────────────────────────

function StatsRow({ bookings }: { bookings: Booking[] }) {
  const today = todayStr()
  const { start: weekStart, end: weekEnd } = thisWeekBounds()

  const todayCount = bookings.filter((b) => b.booking_date === today).length

  const weekTotal = bookings.filter(
    (b) => b.booking_date >= weekStart && b.booking_date <= weekEnd
  ).length

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nextBooking = bookings
    .filter((b) => {
      if (b.status === 'cancelled') return false
      if (b.booking_date > today) return true
      if (b.booking_date < today) return false
      const [h, m] = b.booking_time.split(':').map(Number)
      return h * 60 + m > nowMinutes
    })
    .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time))[0]

  let nextLabel = '—'
  if (nextBooking) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    if (nextBooking.booking_date === today) {
      nextLabel = `Today ${formatTime(nextBooking.booking_time)}`
    } else if (nextBooking.booking_date === tomorrowStr) {
      nextLabel = `Tomorrow ${formatTime(nextBooking.booking_time)}`
    } else {
      nextLabel = `${formatDate(nextBooking.booking_date)} ${formatTime(nextBooking.booking_time)}`
    }
  }

  const stats = [
    { label: "Today's bookings", value: String(todayCount), icon: Calendar },
    { label: 'Next booking', value: nextLabel, icon: Clock },
    { label: 'This week', value: String(weekTotal), icon: ArrowUpRight },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
            <Icon size={14} strokeWidth={1.75} className="text-gray-300" />
          </div>
          <p className="mt-2 truncate text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS: { value: Tab; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'today', label: 'Today' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex">
      {TABS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`relative px-4 py-2.5 text-xs font-medium transition-colors ${
            active === value
              ? 'border-b-2 border-[#3D6BF8] text-[#1E0B6F] -mb-px'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Calendar view ─────────────────────────────────────────────────────────────

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function CalendarView({
  bookings,
  onDayClick,
}: {
  bookings: Booking[]
  onDayClick: (date: string) => void
}) {
  const today = todayStr()
  const [{ year, month }, setYM] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })

  const countsByDate = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of bookings) {
      if (b.status !== 'cancelled') {
        map[b.booking_date] = (map[b.booking_date] ?? 0) + 1
      }
    }
    return map
  }, [bookings])

  const firstDayOffset = (() => {
    const d = new Date(year, month, 1).getDay()
    return d === 0 ? 6 : d - 1 // Mon=0
  })()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDayOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = new Date(year, month).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  function shift(delta: number) {
    setYM(({ year, month }) => {
      const d = new Date(year, month + delta)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
    <div className="bg-white overflow-hidden min-w-[420px]">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <button
          onClick={() => shift(-1)}
          className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-gray-900">{monthLabel}</p>
        <button
          onClick={() => shift(1)}
          className="rounded-md px-2 py-1 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAY_HEADERS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-400">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`e${i}`} className="h-16 border-b border-r border-gray-50 last:border-r-0" />
          }
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const count = countsByDate[dateStr] ?? 0
          const isToday = dateStr === today
          const isWeekend = i % 7 >= 5

          return (
            <button
              key={dateStr}
              onClick={() => count > 0 && onDayClick(dateStr)}
              disabled={count === 0}
              className={`h-16 flex flex-col items-center border-b border-r border-gray-50 pt-2 transition-colors last:border-r-0 ${
                isWeekend ? 'bg-gray-50/50' : ''
              } ${count > 0 ? 'hover:bg-indigo-50 cursor-pointer' : 'cursor-default'}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isToday ? 'bg-[#1E0B6F] text-white' : 'text-gray-700'
                }`}
              >
                {day}
              </span>
              {count > 0 && (
                <span className="mt-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 px-1.5 text-[10px] font-medium text-blue-700">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
    </div>
  )
}

// ── New booking modal ─────────────────────────────────────────────────────────

function NewBookingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (booking: Booking) => void
}) {
  const [services, setServices] = useState<Service[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [serviceId, setServiceId] = useState('')
  const [slotId, setSlotId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load services on mount
  useEffect(() => {
    getMyServices(getFreshToken)
      .then((data) => {
        setServices(data.filter((s) => s.is_active))
      })
      .catch(() => setError('Failed to load services'))
      .finally(() => setLoadingServices(false))
  }, [])

  // Load slots when service changes
  useEffect(() => {
    if (!serviceId) { setSlots([]); return }
    setLoadingSlots(true)
    setSlotId('')
    getMyAvailableSlots(getFreshToken, serviceId)
      .then(setSlots)
      .catch(() => setError('Failed to load available slots'))
      .finally(() => setLoadingSlots(false))
  }, [serviceId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const booking = await createMyBooking(getFreshToken, {
        customer_name: customerName,
        customer_phone: customerPhone,
        service_id: serviceId,
        slot_id: slotId,
      })
      onCreated(booking)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  // Group slots by date for the select
  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {}
    for (const s of slots) {
      ;(map[s.date_label] ??= []).push(s)
    }
    return map
  }, [slots])

  const canSubmit = serviceId && slotId && customerName.trim() && customerPhone.trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">New Booking</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Service */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Service</label>
            {loadingServices ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 size={13} className="animate-spin" /> Loading services…
              </div>
            ) : (
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                required
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3D6BF8]"
              >
                <option value="">Select a service…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes}m)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Time slot */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date &amp; Time</label>
            {loadingSlots ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 size={13} className="animate-spin" /> Loading slots…
              </div>
            ) : (
              <select
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                required
                disabled={!serviceId || slots.length === 0}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#3D6BF8] disabled:opacity-50"
              >
                <option value="">
                  {!serviceId
                    ? 'Select a service first'
                    : slots.length === 0
                    ? 'No slots available'
                    : 'Select a slot…'}
                </option>
                {Object.entries(slotsByDate).map(([dateLabel, daySlots]) => (
                  <optgroup key={dateLabel} label={dateLabel}>
                    {daySlots.map((s) => (
                      <option key={s.slot_id} value={s.slot_id}>
                        {s.time_label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {/* Customer name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#3D6BF8]"
            />
          </div>

          {/* Customer phone */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Customer Phone</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
              placeholder="+27821234567"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#3D6BF8]"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="flex items-center gap-1.5 rounded-md bg-[#1E0B6F] px-4 py-2 text-xs font-medium text-white hover:bg-[#2d1499] transition-colors disabled:opacity-40"
            >
              {submitting && <Loader2 size={12} className="animate-spin" />}
              Create Booking
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookingsView({
  initialBookings,
  clientId,
}: {
  initialBookings: Booking[]
  clientId: string
}) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [view, setView] = useState<ViewMode>('list')
  const [dayFilter, setDayFilter] = useState<string | null>(null)
  const [showNewBooking, setShowNewBooking] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  const today = todayStr()

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `client_id=eq.${clientId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setBookings((prev) => [...prev, payload.new as Booking])
          } else if (payload.eventType === 'UPDATE') {
            setBookings((prev) =>
              prev.map((b) =>
                b.id === (payload.new as Booking).id
                  ? { ...b, ...(payload.new as Booking) }
                  : b
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setBookings((prev) => prev.filter((b) => b.id !== (payload.old as Partial<Booking>).id))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [clientId])

  const handleUpdate = useCallback((updated: Booking) => {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    setSelectedBooking((prev) => (prev?.id === updated.id ? updated : prev))
  }, [])

  const handleDayClick = useCallback((date: string) => {
    setDayFilter(date)
    setTab('all')
    setView('list')
  }, [])

  const filtered = useMemo(() => {
    let list = bookings
    if (tab === 'upcoming') list = list.filter((b) => b.booking_date >= today)
    else if (tab === 'today') list = list.filter((b) => b.booking_date === today)
    else if (tab === 'past') list = list.filter((b) => b.booking_date < today)
    if (dayFilter) list = list.filter((b) => b.booking_date === dayFilter)
    return [...list].sort(
      (a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time)
    )
  }, [bookings, tab, today, dayFilter])

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {showNewBooking && (
        <NewBookingModal
          onClose={() => setShowNewBooking(false)}
          onCreated={(booking) => setBookings((prev) => [...prev, booking])}
        />
      )}

      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          allBookings={bookings}
          token={getFreshToken}
          onClose={() => setSelectedBooking(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Bookings</h2>
          <p className="mt-0.5 text-sm text-gray-500">{bookings.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewBooking(true)}
            className="flex items-center gap-1.5 rounded-md bg-[#1E0B6F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#2d1499] transition-colors"
          >
            <Plus size={13} strokeWidth={2} />
            New Booking
          </button>
          <button
            onClick={() => setView((v) => (v === 'list' ? 'calendar' : 'list'))}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'calendar'
                ? 'border-[#3D6BF8] bg-[#1E0B6F] text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {view === 'calendar' ? <List size={13} strokeWidth={1.75} /> : <Calendar size={13} strokeWidth={1.75} />}
            {view === 'calendar' ? 'List view' : 'Calendar view'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsRow bookings={bookings} />

      {/* Calendar or list */}
      {view === 'calendar' ? (
        <CalendarView bookings={bookings} onDayClick={handleDayClick} />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* Tabs + day filter */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4">
            <TabBar
              active={tab}
              onChange={(t) => { setTab(t); setDayFilter(null) }}
            />
            {dayFilter && (
              <button
                onClick={() => setDayFilter(null)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                {formatDate(dayFilter)}
                <span className="ml-0.5 text-gray-400">×</span>
              </button>
            )}
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare size={28} strokeWidth={1.5} className="mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">No bookings found</p>
              <p className="mt-1 text-xs text-gray-300">
                {tab === 'today'
                  ? 'Nothing scheduled for today.'
                  : 'No bookings match this filter.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400 hidden md:table-cell">Assigned</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    onUpdate={handleUpdate}
                    onSelect={setSelectedBooking}
                  />
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
