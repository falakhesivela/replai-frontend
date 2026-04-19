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
  confirmed: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  cancelled: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  completed: 'bg-gray-100 text-gray-500',
  no_show: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
}

const STATUS_LABELS: Record<Booking['status'], string> = {
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
          <h1 className="text-xl font-semibold text-gray-900">My Bookings</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {upcomingCount > 0 ? `${upcomingCount} upcoming` : 'No upcoming bookings'}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <Bookmark size={16} strokeWidth={1.75} className="text-gray-500" />
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 px-4">
            {TABS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`relative px-4 py-2.5 text-xs font-medium transition-colors ${
                  tab === value
                    ? 'border-b-2 border-[#3D6BF8] text-[#1E0B6F] -mb-px'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar size={28} strokeWidth={1.5} className="mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">No bookings here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400 hidden sm:table-cell">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setSelected(b)}
                      className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} strokeWidth={1.75} className="shrink-0 text-gray-300" />
                          <span className="font-medium text-gray-900">{formatTime(b.booking_time)}</span>
                        </div>
                        <div className="mt-0.5 pl-[18px] text-xs text-gray-400">{formatDate(b.booking_date)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{b.customer_name}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {b.services ? (
                          <div className="flex items-center gap-1">
                            <Scissors size={11} strokeWidth={1.75} className="shrink-0 text-gray-300" />
                            {b.services.name}
                          </div>
                        ) : (
                          <span className="italic text-gray-300">Unknown</span>
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
