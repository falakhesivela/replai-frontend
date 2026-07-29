'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, Calendar, Clock, Loader2, Scissors } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMyAssignedBookings, PortalAuthError, type TokenGetter } from '@/lib/api'
import type { Booking } from '@/lib/types'
import BookingDetailPanel from '../../bookings/_components/booking-detail-panel'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
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
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

const STATUS_STYLES: Record<Booking['status'], string> = {
  reserved: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  confirmed: 'bg-success-soft text-success ring-1 ring-success/25',
  cancelled: 'bg-danger-soft text-danger ring-1 ring-danger/25',
  completed: 'bg-surface-2 text-ink-2',
  no_show: 'bg-warning-soft text-warning ring-1 ring-warning/25',
}

const STATUS_LABELS: Record<Booking['status'], string> = {
  reserved: 'Reserved',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
}

type Tab = 'upcoming' | 'past' | 'all'
const TABS: { value: Tab; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
]

export default function MyBookingsView() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [selected, setSelected] = useState<Booking | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBookings(await getMyAssignedBookings(getFreshToken))
    } catch (e) {
      if (e instanceof PortalAuthError) {
        router.replace('/portal/login')
        return
      }
      setError('Failed to load bookings.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void load() }, [load])

  const handleUpdate = useCallback((updated: Booking) => {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
    setSelected((prev) => (prev?.id === updated.id ? updated : prev))
  }, [])

  const today = new Date().toISOString().slice(0, 10)

  const filtered = bookings
    .filter((b) => {
      if (tab === 'upcoming') return b.booking_date >= today
      if (tab === 'past') return b.booking_date < today
      return true
    })
    .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time))

  const upcomingCount = bookings.filter((b) => b.status === 'confirmed' && b.booking_date >= today).length

  return (
    <div className="max-w-3xl space-y-6">
      {selected && (
        <BookingDetailPanel
          booking={selected}
          allBookings={bookings}
          token={getFreshToken}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Heading */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">My Bookings</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            {upcomingCount > 0 ? `${upcomingCount} upcoming` : 'No upcoming bookings'}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2">
          <Bookmark size={16} strokeWidth={1.75} className="text-ink-2" />
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-ink-3" />
        </div>
      ) : error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
      ) : (
        <div className="rounded-xl border border-line bg-surface shadow-card overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-line px-4">
            {TABS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`relative px-4 py-2.5 text-xs font-medium transition-colors ${
                  tab === value
                    ? 'border-b-2 border-accent text-accent-text -mb-px'
                    : 'text-ink-3 hover:text-ink-2'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar size={28} strokeWidth={1.5} className="mb-3 text-ink-3/50" />
              <p className="text-sm text-ink-3">No bookings here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-3">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-3">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-3 hidden sm:table-cell">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setSelected(b)}
                      className="cursor-pointer hover:bg-surface-2/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                          <span className="font-medium text-ink">{formatTime(b.booking_time)}</span>
                        </div>
                        <div className="mt-0.5 pl-[18px] text-xs text-ink-3">{formatDate(b.booking_date)}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-2">{b.customer_name}</td>
                      <td className="px-4 py-3 text-ink-2 hidden sm:table-cell">
                        {b.services ? (
                          <div className="flex items-center gap-1">
                            <Scissors size={11} strokeWidth={1.75} className="shrink-0 text-ink-3" />
                            {b.services.name}
                          </div>
                        ) : (
                          <span className="italic text-ink-3">Unknown</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[b.status]}`}>
                          {STATUS_LABELS[b.status]}
                        </span>
                      </td>
                    </tr>
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
