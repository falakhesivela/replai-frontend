'use client'

import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarX,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/toast'
import { saveTimezoneAction, type TimezoneState } from '../actions'
import {
  addMyClosedDate,
  deleteMyClosedDate,
  getAfterHoursMessages,
  getMyBusinessHours,
  markAfterHoursMessageRead,
  setMyBusinessHours,
  setTempClosure,
  updateMyReminderSettings,
  type TokenGetter,
} from '@/lib/api'
import type { AfterHoursMessage, BusinessHoursItem, Client, ClosedDate } from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const TIMEZONES = [
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST, UTC+2)' },
  { value: 'Africa/Lagos',        label: 'Africa/Lagos (WAT, UTC+1)' },
  { value: 'Africa/Nairobi',      label: 'Africa/Nairobi (EAT, UTC+3)' },
  { value: 'Europe/London',       label: 'Europe/London (GMT/BST)' },
  { value: 'America/New_York',    label: 'America/New_York (EST/EDT, UTC-5)' },
]

const DEFAULT_SCHEDULE: BusinessHoursItem[] = [
  { day_of_week: 0, is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day_of_week: 1, is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day_of_week: 2, is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day_of_week: 3, is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day_of_week: 4, is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day_of_week: 5, is_open: true,  open_time: '08:00', close_time: '13:00' },
  { day_of_week: 6, is_open: false, open_time: null,    close_time: null    },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function mergeSchedule(incoming: BusinessHoursItem[]): BusinessHoursItem[] {
  const byDay = new Map(incoming.map((h) => [h.day_of_week, h]))
  return DEFAULT_SCHEDULE.map((d) => byDay.get(d.day_of_week) ?? { ...d })
}

function getEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getSAHolidays(year: number): { name: string; date: string }[] {
  const easter = getEaster(year)
  const goodFriday = new Date(easter)
  goodFriday.setDate(easter.getDate() - 2)

  return [
    { name: "New Year's Day",          date: `${year}-01-01` },
    { name: 'Human Rights Day',        date: `${year}-03-21` },
    { name: 'Good Friday',             date: toISO(goodFriday) },
    { name: 'Freedom Day',             date: `${year}-04-27` },
    { name: "Workers' Day",            date: `${year}-05-01` },
    { name: 'Youth Day',               date: `${year}-06-16` },
    { name: 'National Women\'s Day',   date: `${year}-08-09` },
    { name: 'Heritage Day',            date: `${year}-09-24` },
    { name: 'Day of Reconciliation',   date: `${year}-12-16` },
    { name: 'Christmas Day',           date: `${year}-12-25` },
    { name: 'Day of Goodwill',         date: `${year}-12-26` },
  ]
}

function getUpcomingHolidays(): { name: string; date: string }[] {
  const today = toISO(new Date())
  const year = new Date().getFullYear()
  return [
    ...getSAHolidays(year),
    ...getSAHolidays(year + 1),
  ].filter((h) => h.date >= today)
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function maskPhone(phone: string): string {
  if (phone.length <= 6) return phone
  return `${phone.slice(0, 4)} ••• ${phone.slice(-3)}`
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

// ── Shared primitives ─────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:bg-surface-2 disabled:text-ink-3 disabled:cursor-not-allowed'

const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-accent shadow-sm shadow-accent/25 px-3 py-2 text-sm font-medium text-on-solid hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

const btnGhost =
  'inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-line bg-surface shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-line">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-ink-2">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

function DayToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
        checked ? 'bg-accent' : 'bg-line'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-surface shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ── Section 1: Weekly schedule ────────────────────────────────────────────────

function ScheduleSection({
  initial,
  getToken,
}: {
  initial: BusinessHoursItem[]
  getToken: TokenGetter
}) {
  const { toast } = useToast()
  const [schedule, setSchedule] = useState<BusinessHoursItem[]>(() => mergeSchedule(initial))
  const [saving, setSaving] = useState(false)

  function updateDay(
    dow: number,
    patch: Partial<Pick<BusinessHoursItem, 'is_open' | 'open_time' | 'close_time'>>
  ) {
    setSchedule((prev) =>
      prev.map((row) =>
        row.day_of_week === dow
          ? {
              ...row,
              ...patch,
              // Clear times when closing
              ...(patch.is_open === false ? { open_time: null, close_time: null } : {}),
              // Restore defaults when re-opening if still null
              ...(patch.is_open === true && !row.open_time
                ? { open_time: '08:00', close_time: '17:00' }
                : {}),
            }
          : row
      )
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await setMyBusinessHours(getToken, schedule)
      setSchedule(mergeSchedule(saved))
      toast.success('Schedule saved.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save schedule.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title="Weekly schedule"
      description="Set your regular opening hours for each day of the week."
    >
      <div className="overflow-x-auto">
      <div className="space-y-1 min-w-[420px]">
        {/* Header row */}
        <div className="hidden sm:grid grid-cols-[120px_52px_1fr_1fr] gap-3 pb-1 text-xs font-medium text-ink-3 uppercase tracking-wide">
          <span>Day</span>
          <span>Open?</span>
          <span>Opens</span>
          <span>Closes</span>
        </div>

        {schedule.map((row) => (
          <div
            key={row.day_of_week}
            className="grid grid-cols-[120px_52px_1fr_1fr] items-center gap-3 py-2 border-b border-line/60 last:border-0"
          >
            <span className="text-sm font-medium text-ink-2">
              {DAY_NAMES[row.day_of_week]}
            </span>

            <DayToggle
              checked={row.is_open}
              onChange={(v) => updateDay(row.day_of_week, { is_open: v })}
            />

            <input
              type="time"
              value={row.open_time ?? ''}
              disabled={!row.is_open}
              onChange={(e) => updateDay(row.day_of_week, { open_time: e.target.value || null })}
              className={inputClass}
            />

            <input
              type="time"
              value={row.close_time ?? ''}
              disabled={!row.is_open}
              onChange={(e) => updateDay(row.day_of_week, { close_time: e.target.value || null })}
              className={inputClass}
            />
          </div>
        ))}
      </div>
      </div>

      <div className="flex justify-end mt-5">
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
          {saving ? 'Saving…' : 'Save schedule'}
        </button>
      </div>
    </SectionCard>
  )
}

// ── Section 2: Temporary closure ─────────────────────────────────────────────

function TempClosureCard({
  initialClosed,
  initialMessage,
  getToken,
}: {
  initialClosed: boolean
  initialMessage: string | null | undefined
  getToken: TokenGetter
}) {
  const { toast } = useToast()
  const [isClosed, setIsClosed] = useState(initialClosed)
  const [message, setMessage] = useState(initialMessage ?? '')
  const [saving, setSaving] = useState(false)

  async function handleToggle(next: boolean) {
    // Optimistic update
    setIsClosed(next)
    setSaving(true)
    try {
      await setTempClosure(getToken, next, next ? (message || null) : null)
      toast.success(next ? 'Away mode enabled.' : 'Away mode disabled.')
    } catch (err) {
      setIsClosed(!next) // revert
      toast.error(err instanceof Error ? err.message : 'Failed to update.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveMessage() {
    setSaving(true)
    try {
      await setTempClosure(getToken, isClosed, message || null)
      toast.success('Away message saved.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save message.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      className={`rounded-lg border-2 bg-surface overflow-hidden transition-colors ${
        isClosed ? 'border-warning/30' : 'border-line'
      }`}
    >
      <div
        className={`px-6 py-4 flex items-center justify-between transition-colors ${
          isClosed ? 'bg-warning-soft border-b border-warning/30' : 'border-b border-line'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">Away mode</h3>
            {isClosed && (
              <span className="inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                Active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-2">
            Temporarily close and give the AI a custom message to reply with.
          </p>
        </div>
        <DayToggle
          checked={isClosed}
          onChange={handleToggle}
        />
      </div>

      <div
        className={`px-6 py-5 space-y-4 transition-opacity ${
          isClosed ? 'opacity-100' : 'opacity-50 pointer-events-none'
        }`}
      >
        <div>
          <label
            htmlFor="temp_closed_message"
            className="block text-sm font-medium text-ink-2 mb-1"
          >
            Message for the AI to reply with
          </label>
          <textarea
            id="temp_closed_message"
            rows={3}
            placeholder="e.g. We're in a meeting until 3pm. We'll get back to you shortly."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <p className="mt-1 text-xs text-ink-3">
            Customers will see this message and be asked if they want to leave a message for you.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveMessage}
            className={btnPrimary}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
            {saving ? 'Saving…' : 'Save message'}
          </button>
        </div>
      </div>

      {!isClosed && (
        <div className="px-6 py-4 text-xs text-ink-3">
          Toggle away mode on to set a custom message.
        </div>
      )}
    </section>
  )
}

// ── Section 3: Timezone ───────────────────────────────────────────────────────

function TimezoneSaveButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className={btnPrimary}>
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
      {pending ? 'Saving…' : 'Save timezone'}
    </button>
  )
}

function TimezoneSection({ currentTimezone }: { currentTimezone: string }) {
  const { toast } = useToast()
  const [state, action, pending] = useActionState(saveTimezoneAction, {} as TimezoneState)

  useEffect(() => {
    if (state.success) toast.success('Timezone saved.')
    else if (state.error) toast.error(state.error)
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SectionCard
      title="Timezone"
      description="Used to determine whether your business is currently open."
    >
      <form action={action} className="flex flex-col sm:flex-row items-end gap-3">
        <div className="flex-1 w-full">
          <label htmlFor="timezone" className="block text-sm font-medium text-ink-2 mb-1">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={currentTimezone}
            className={inputClass}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
        <TimezoneSaveButton pending={pending} />
      </form>
    </SectionCard>
  )
}

// ── Section 4: Closed dates ───────────────────────────────────────────────────

function ClosedDatesSection({
  initial,
  getToken,
}: {
  initial: ClosedDate[]
  getToken: TokenGetter
}) {
  const { toast } = useToast()
  const [dates, setDates] = useState<ClosedDate[]>(initial)
  const [newDate, setNewDate] = useState('')
  const [newReason, setNewReason] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const holidays = getUpcomingHolidays()
  const existingDates = new Set(dates.map((d) => d.date))

  async function handleAdd(date: string, reason: string) {
    if (!date) return
    if (existingDates.has(date)) {
      toast.error('That date is already in the list.')
      return
    }
    setAdding(true)
    try {
      const created = await addMyClosedDate(getToken, date, reason || null)
      setDates((prev) =>
        [...prev, created].sort((a, b) => a.date.localeCompare(b.date))
      )
      setNewDate('')
      setNewReason('')
      toast.success('Closed date added.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add date.')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(date: string) {
    setRemoving(date)
    try {
      await deleteMyClosedDate(getToken, date)
      setDates((prev) => prev.filter((d) => d.date !== date))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove date.')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <SectionCard
      title="Closed dates"
      description="Add public holidays or one-off days when you won't be taking messages."
    >
      {/* Quick-add SA public holidays */}
      <div className="mb-5">
        <p className="text-xs font-medium text-ink-2 mb-2">
          SA public holidays — click to add:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {holidays.map((h) => {
            const already = existingDates.has(h.date)
            return (
              <button
                key={h.date}
                type="button"
                disabled={already || adding}
                onClick={() => handleAdd(h.date, h.name)}
                title={formatDate(h.date)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  already
                    ? 'border-line bg-surface-2 text-ink-3 cursor-not-allowed'
                    : 'border-line-strong bg-surface text-ink-2 hover:border-accent hover:bg-surface-2'
                }`}
              >
                {already && <Check size={10} className="inline mr-1 text-ink-3" />}
                {h.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Manual add form */}
      <div className="flex flex-col sm:flex-row items-end gap-2 mb-5">
        <div className="flex-1 w-full">
          <label className="block text-xs font-medium text-ink-2 mb-1">Date</label>
          <input
            type="date"
            value={newDate}
            min={toISO(new Date())}
            onChange={(e) => setNewDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex-[2] w-full">
          <label className="block text-xs font-medium text-ink-2 mb-1">
            Reason <span className="text-ink-3">(optional)</span>
          </label>
          <input
            type="text"
            value={newReason}
            placeholder="e.g. Public holiday"
            onChange={(e) => setNewReason(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd(newDate, newReason)}
            className={inputClass}
          />
        </div>
        <button
          type="button"
          disabled={!newDate || adding}
          onClick={() => handleAdd(newDate, newReason)}
          className={btnPrimary}
        >
          {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} strokeWidth={2.5} />}
          Add
        </button>
      </div>

      {/* Table */}
      {dates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-ink-3">
          <CalendarX size={28} strokeWidth={1.5} className="mb-2" />
          <p className="text-sm">No closed dates added yet.</p>
        </div>
      ) : (
        <div className="rounded-md border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 border-b border-line">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-2">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-ink-2">Reason</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {dates.map((d) => (
                <tr key={d.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3 text-ink whitespace-nowrap">{formatDate(d.date)}</td>
                  <td className="px-4 py-3 text-ink-2">{d.reason ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={removing === d.date}
                      onClick={() => handleRemove(d.date)}
                      className="rounded p-1 text-ink-3 hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40"
                      aria-label="Remove"
                    >
                      {removing === d.date ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} strokeWidth={1.75} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  )
}

// ── Section 5: After-hours messages ──────────────────────────────────────────

function AfterHoursSection({
  initial,
  clientId,
  getToken,
}: {
  initial: AfterHoursMessage[]
  clientId: string
  getToken: TokenGetter
}) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<AfterHoursMessage[]>(initial)
  const [marking, setMarking] = useState<string | null>(null)
  const getTokenRef = useRef(getToken)
  getTokenRef.current = getToken

  // Refresh unread messages from the API
  const refresh = useCallback(async () => {
    try {
      const fresh = await getAfterHoursMessages(getTokenRef.current)
      setMessages(fresh)
    } catch {
      // silent — stale data is fine
    }
  }, [])

  // Supabase Realtime subscription — re-fetch on any INSERT
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`after-hours-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'after_hours_messages',
          filter: `client_id=eq.${clientId}`,
        },
        () => void refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clientId, refresh])

  async function handleMarkRead(id: string) {
    setMarking(id)
    try {
      await markAfterHoursMessageRead(getToken, id)
      setMessages((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark as read.')
    } finally {
      setMarking(null)
    }
  }

  const count = messages.length

  return (
    <SectionCard
      title="After-hours messages"
      description="Messages customers left while you were closed."
    >
      {/* Unread count badge */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            count > 0 ? 'bg-accent text-on-solid' : 'bg-surface-2 text-ink-2'
          }`}
        >
          <MessageSquare size={11} />
          {count} unread {count === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-ink-3">
          <MessageSquare size={28} strokeWidth={1.5} className="mb-2" />
          <p className="text-sm">No unread after-hours messages.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-ink-2 font-mono">
                    {maskPhone(m.customer_phone)}
                  </span>
                  <span className="text-xs text-ink-3">{relativeTime(m.created_at)}</span>
                </div>
                <p className="text-sm text-ink-2 line-clamp-3 break-words">{m.message}</p>
              </div>
              <button
                type="button"
                disabled={marking === m.id}
                onClick={() => handleMarkRead(m.id)}
                className={`${btnGhost} shrink-0`}
                aria-label="Mark as read"
              >
                {marking === m.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Check size={12} strokeWidth={2.5} />
                )}
                <span className="hidden sm:inline">Mark read</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

// ── Section 5: Reminder settings ─────────────────────────────────────────────

const REMINDER_OPTIONS = [
  { value: 1,  label: '1 hour before' },
  { value: 2,  label: '2 hours before' },
  { value: 6,  label: '6 hours before' },
  { value: 12, label: '12 hours before' },
  { value: 24, label: '24 hours before (day before)' },
  { value: 48, label: '48 hours before (2 days before)' },
]

function ReminderSection({
  initialEnabled,
  initialHoursBefore,
  getToken,
}: {
  initialEnabled: boolean
  initialHoursBefore: number
  getToken: TokenGetter
}) {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [hoursBefore, setHoursBefore] = useState(initialHoursBefore)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateMyReminderSettings(getToken, {
        reminder_enabled: enabled,
        reminder_hours_before: hoursBefore,
      })
      toast.success('Reminder settings saved.')
    } catch {
      toast.error('Failed to save reminder settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionCard
      title="Appointment reminders"
      description="Automatically send customers a WhatsApp reminder before their appointment."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-ink">Send reminders</p>
            <p className="text-xs text-ink-2 mt-0.5">Customers get a WhatsApp message before their appointment.</p>
          </div>
          <DayToggle checked={enabled} onChange={setEnabled} />
        </div>

        {enabled && (
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1.5">
              When to send
            </label>
            <select
              value={hoursBefore}
              onChange={(e) => setHoursBefore(Number(e.target.value))}
              className={inputClass}
            >
              {REMINDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={btnPrimary}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </SectionCard>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function BusinessHoursForm({
  client,
  initialBusinessHours,
  initialClosedDates,
  initialAfterHoursMessages,
}: {
  client: Client
  initialBusinessHours: BusinessHoursItem[]
  initialClosedDates: ClosedDate[]
  initialAfterHoursMessages: AfterHoursMessage[]
}) {
  // Fresh token getter — avoids stale JWT on any API call
  const getToken: TokenGetter = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  const timezone = client.timezone ?? 'Africa/Johannesburg'

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/portal/settings"
          className="rounded-md p-1.5 text-ink-3 hover:text-ink-2 hover:bg-surface-2 transition-colors"
          aria-label="Back to settings"
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Business Hours</h1>
          <p className="text-sm text-ink-2">Manage when your AI responds and collects messages.</p>
        </div>
      </div>

      <ScheduleSection initial={initialBusinessHours} getToken={getToken} />
      <TempClosureCard
        initialClosed={client.temp_closed ?? false}
        initialMessage={client.temp_closed_message}
        getToken={getToken}
      />
      <TimezoneSection currentTimezone={timezone} />
      <ClosedDatesSection initial={initialClosedDates} getToken={getToken} />
      <ReminderSection
        initialEnabled={client.reminder_enabled ?? true}
        initialHoursBefore={client.reminder_hours_before ?? 24}
        getToken={getToken}
      />
      <AfterHoursSection
        initial={initialAfterHoursMessages}
        clientId={client.id}
        getToken={getToken}
      />
    </div>
  )
}
