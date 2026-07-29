'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Clock,
  Loader2,
  Mail,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getPortalTeamDirectory,
  getMyBookings,
  patchPortalTeamMember,
  PortalAuthError,
} from '@/lib/api'
import type { Booking, PortalTeamRow } from '@/lib/types'
import { usePermissions } from '@/hooks/usePermissions'
import { Card } from '@/components/ui'

const getFreshToken = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function roleBadgeClasses(role: PortalTeamRow['role']): string {
  if (role === 'owner') return 'bg-violet-100 text-violet-800 ring-violet-600/15'
  if (role === 'manager') return 'bg-info-soft text-info ring-info/25'
  return 'bg-surface-2 text-ink-2 ring-line'
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

const BOOKING_STATUS_STYLES: Record<Booking['status'], string> = {
  reserved: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  confirmed: 'bg-success-soft text-success ring-1 ring-success/25',
  cancelled: 'bg-danger-soft text-danger ring-1 ring-danger/25',
  completed: 'bg-surface-2 text-ink-2',
  no_show: 'bg-warning-soft text-warning ring-1 ring-warning/25',
}

const BOOKING_STATUS_LABELS: Record<Booking['status'], string> = {
  reserved: 'Reserved',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
}

export function TeamMemberDetailPage({ memberId }: { memberId: string }) {
  const router = useRouter()
  const { can } = usePermissions()
  const canManage = can('manage_team')

  const [member, setMember] = useState<PortalTeamRow | null>(null)
  const [assignedBookings, setAssignedBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingBookable, setTogglingBookable] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dir, bookings] = await Promise.all([
        getPortalTeamDirectory(getFreshToken),
        getMyBookings(getFreshToken),
      ])
      const found = dir.rows.find((r) => r.member_id === memberId)
      if (!found) {
        setError('Team member not found.')
        return
      }
      setMember(found)
      setAssignedBookings(bookings.filter((b) => b.assigned_to === memberId))
    } catch (e) {
      if (e instanceof PortalAuthError) {
        router.replace('/portal/login')
        return
      }
      setError('Failed to load member details.')
    } finally {
      setLoading(false)
    }
  }, [memberId, router])

  useEffect(() => { void load() }, [load])

  async function toggleBookable() {
    if (!member?.member_id || !canManage) return
    setTogglingBookable(true)
    try {
      await patchPortalTeamMember(getFreshToken, member.member_id, {
        is_bookable: !member.is_bookable,
      })
      setMember((prev) => prev ? { ...prev, is_bookable: !prev.is_bookable } : prev)
    } finally {
      setTogglingBookable(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-ink-3" />
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
        <p className="text-sm text-danger">{error ?? 'Member not found.'}</p>
      </div>
    )
  }

  const color = member.avatar_color || '#6b7280'
  const upcoming = assignedBookings
    .filter((b) => b.status === 'confirmed' && b.booking_date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time))

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push('/portal/team')}
        className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.75} /> Team
      </button>

      {/* Two-column layout on large screens */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Left column: profile + bookable */}
        <div className="space-y-4 lg:col-span-1">
          {/* Profile card */}
          <Card>
            <div className="flex items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-on-solid shadow-sm"
                style={{ backgroundColor: color }}
              >
                {initials(member.name || member.email)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold tracking-tight text-ink">{member.name || '—'}</h1>
                  {member.is_self && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-solid">
                      You
                    </span>
                  )}
                </div>
                <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${member.custom_role ? 'bg-accent-soft text-accent-text ring-accent/15' : roleBadgeClasses(member.role)}`}>
                  {member.custom_role?.name ?? (member.role.charAt(0).toUpperCase() + member.role.slice(1))}
                </span>
                <div className="mt-2 flex items-center gap-2 text-sm text-ink-2">
                  <Mail size={13} strokeWidth={1.75} className="shrink-0" />
                  <span className="truncate">{member.email}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  {member.is_active ? (
                    <span className="flex items-center gap-1.5 text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-ink-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-line-strong" /> Inactive
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-5">
              {[
                { label: 'Conversations', value: member.conversation_count },
                { label: 'Bookings', value: assignedBookings.length },
                { label: 'Upcoming', value: upcoming.length },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Bookable toggle */}
          {member.role !== 'owner' && (
            <Card padding="sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bookmark size={16} strokeWidth={1.75} className="text-ink-3" />
                  <div>
                    <p className="text-sm font-medium text-ink">Bookable</p>
                    <p className="text-xs text-ink-2">
                      Bookings can be assigned to this member.
                    </p>
                  </div>
                </div>
                {canManage && member.member_id ? (
                  <button
                    onClick={toggleBookable}
                    disabled={togglingBookable}
                    className="shrink-0 disabled:opacity-40 transition-opacity"
                    aria-label={member.is_bookable ? 'Disable bookable' : 'Enable bookable'}
                  >
                    {togglingBookable ? (
                      <Loader2 size={24} className="animate-spin text-ink-3" />
                    ) : member.is_bookable ? (
                      <ToggleRight size={28} className="text-ink" />
                    ) : (
                      <ToggleLeft size={28} className="text-ink-3" />
                    )}
                  </button>
                ) : (
                  <span className={`text-xs font-medium ${member.is_bookable ? 'text-success' : 'text-ink-3'}`}>
                    {member.is_bookable ? 'Enabled' : 'Disabled'}
                  </span>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right column: assigned bookings */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-ink-2">Assigned bookings</h2>
          {assignedBookings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line py-16 text-center">
              <Calendar size={24} className="mx-auto mb-2 text-ink-3/50" />
              <p className="text-sm text-ink-3">No bookings assigned yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-surface shadow-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-3">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-3">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-3 hidden sm:table-cell">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-ink-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {assignedBookings
                    .sort((a, b) => a.booking_date.localeCompare(b.booking_date) || a.booking_time.localeCompare(b.booking_time))
                    .map((b) => (
                      <tr key={b.id} className="hover:bg-surface-2/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-ink">{formatTime(b.booking_time)}</div>
                          <div className="text-xs text-ink-3">{formatDate(b.booking_date)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-2">{b.customer_name}</td>
                        <td className="px-4 py-3 text-sm text-ink-2 hidden sm:table-cell">
                          {b.services?.name ?? <span className="italic text-ink-3">Unknown</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BOOKING_STATUS_STYLES[b.status]}`}>
                            {BOOKING_STATUS_LABELS[b.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
