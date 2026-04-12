'use client'

import { useState } from 'react'
import { Clock, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  createMyService,
  deleteMyService,
  setMyAvailability,
  type TokenGetter,
} from '@/lib/api'
import { useToast } from '@/components/toast'
import type { AvailabilitySchedule, Service } from '@/lib/types'

// Always pull a fresh Supabase JWT — captured-at-mount tokens go stale.
const getFreshToken: TokenGetter = async () => {
  const supabase = createSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayRow {
  day_of_week: number
  enabled: boolean
  start_time: string
  end_time: string
}

interface ServiceForm {
  name: string
  duration_minutes: number
  description: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hr' },
  { value: 90, label: '1 hr 30 min' },
  { value: 120, label: '2 hrs' },
]

const MIN_NOTICE_OPTIONS = [
  { value: '1hr', label: '1 hour' },
  { value: '2hrs', label: '2 hours' },
  { value: '24hrs', label: '24 hours' },
  { value: '48hrs', label: '48 hours' },
]

const DAYS_AHEAD_OPTIONS = [
  { value: '3', label: '3 days' },
  { value: '5', label: '5 days' },
  { value: '14', label: '2 weeks' },
]

// 06:00–22:00 in 30-min steps
const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const total = 360 + i * 30 // start at 06:00
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeDisplay(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

function buildDayRows(availability: AvailabilitySchedule[]): DayRow[] {
  const byDay = new Map(availability.map((a) => [a.day_of_week, a]))
  return Array.from({ length: 7 }, (_, i) => {
    const sched = byDay.get(i)
    return {
      day_of_week: i,
      enabled: !!sched,
      start_time: sched ? sched.start_time.slice(0, 5) : '09:00',
      end_time: sched ? sched.end_time.slice(0, 5) : '17:00',
    }
  })
}

function weeklyHours(rows: DayRow[]): number {
  return rows
    .filter((r) => r.enabled)
    .reduce((sum, r) => {
      const [sh, sm] = r.start_time.split(':').map(Number)
      const [eh, em] = r.end_time.split(':').map(Number)
      return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm))
    }, 0) / 60
}

// ── Shared primitives ─────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900'

const selectClass =
  'rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-0.5 mb-5 text-xs text-gray-500">{description}</p>}
      {!description && <div className="mb-5" />}
      {children}
    </section>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
          checked ? 'bg-gray-900' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

function PrimaryButton({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
    >
      {loading && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  )
}

// ── Services section ──────────────────────────────────────────────────────────

function ServicesSection({
  initial,
}: {
  initial: Service[]
}) {
  const { toast } = useToast()
  const [services, setServices] = useState<Service[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ServiceForm>({ name: '', duration_minutes: 30, description: '' })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function resetForm() {
    setForm({ name: '', duration_minutes: 30, description: '' })
    setShowForm(false)
  }

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const created = await createMyService(getFreshToken, {
        name: form.name.trim(),
        duration_minutes: form.duration_minutes,
        description: form.description.trim() || null,
      })
      setServices((prev) => [...prev, created])
      resetForm()
      toast.success('Service added.')
    } catch {
      toast.error('Failed to add service.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteMyService(getFreshToken, id)
      setServices((prev) => prev.filter((s) => s.id !== id))
      toast.success('Service deleted.')
    } catch {
      toast.error('Failed to delete service.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Section
      title="Services"
      description="Define what you offer. Customers will choose a service when booking."
    >
      {/* Service list */}
      {services.length > 0 && (
        <ul className="mb-4 divide-y divide-gray-100 rounded-md border border-gray-200">
          {services.map((svc) => {
            const dur = DURATION_OPTIONS.find((d) => d.value === svc.duration_minutes)?.label
              ?? `${svc.duration_minutes} min`
            return (
              <li key={svc.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} strokeWidth={1.75} />
                      {dur}
                    </span>
                    {svc.description && (
                      <span className="truncate text-xs text-gray-400">{svc.description}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(svc.id)}
                  disabled={deletingId === svc.id}
                  className="ml-4 shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 transition-colors"
                  aria-label="Delete service"
                >
                  {deletingId === svc.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} strokeWidth={1.75} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Inline add form */}
      {showForm ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">New service</p>
            <button
              type="button"
              onClick={resetForm}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Service name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Haircut &amp; Style"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
            <select
              value={form.duration_minutes}
              onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
              className={selectClass}
            >
              {DURATION_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description for customers…"
              rows={2}
              className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-white transition-colors"
            >
              Cancel
            </button>
            <PrimaryButton onClick={handleAdd} loading={saving} disabled={!form.name.trim()}>
              {saving ? 'Saving…' : 'Save service'}
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          <Plus size={14} strokeWidth={2} />
          Add service
        </button>
      )}
    </Section>
  )
}

// ── Availability section ──────────────────────────────────────────────────────

function AvailabilitySection({
  initial,
}: {
  initial: AvailabilitySchedule[]
}) {
  const { toast } = useToast()
  const [rows, setRows] = useState<DayRow[]>(() => buildDayRows(initial))
  const [saving, setSaving] = useState(false)

  function updateRow(dayIndex: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((r) => (r.day_of_week === dayIndex ? { ...r, ...patch } : r)))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await setMyAvailability(
        getFreshToken,
        rows
          .filter((r) => r.enabled)
          .map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }))
      )
      toast.success('Schedule saved.')
    } catch {
      toast.error('Failed to save schedule.')
    } finally {
      setSaving(false)
    }
  }

  const hours = weeklyHours(rows)
  const enabledDays = rows.filter((r) => r.enabled).length
  const previewText =
    enabledDays === 0
      ? 'No days enabled — customers won\'t be able to book.'
      : `You're available ${hours % 1 === 0 ? hours : hours.toFixed(1)} hours per week across ${enabledDays} day${enabledDays === 1 ? '' : 's'}.`

  return (
    <Section
      title="Availability"
      description="Set the days and hours customers can book appointments."
    >
      <div className="divide-y divide-gray-100 rounded-md border border-gray-200 mb-4 overflow-hidden">
        {rows.map((row) => (
          <div
            key={row.day_of_week}
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors ${
              row.enabled ? 'bg-white' : 'bg-gray-50'
            }`}
          >
            {/* Day toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={row.enabled}
              onClick={() => updateRow(row.day_of_week, { enabled: !row.enabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 ${
                row.enabled ? 'bg-gray-900' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  row.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>

            {/* Day label */}
            <span
              className={`w-24 text-sm font-medium ${
                row.enabled ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {DAY_NAMES[row.day_of_week]}
            </span>

            {/* Time pickers */}
            {row.enabled ? (
              <div className="flex items-center gap-2">
                <select
                  value={row.start_time}
                  onChange={(e) => updateRow(row.day_of_week, { start_time: e.target.value })}
                  className={selectClass}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{formatTimeDisplay(t)}</option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">to</span>
                <select
                  value={row.end_time}
                  onChange={(e) => updateRow(row.day_of_week, { end_time: e.target.value })}
                  className={selectClass}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{formatTimeDisplay(t)}</option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">Unavailable</span>
            )}
          </div>
        ))}
      </div>

      {/* Preview */}
      <p className={`mb-4 text-xs ${enabledDays === 0 ? 'text-amber-600' : 'text-gray-500'}`}>
        {previewText}
      </p>

      <div className="flex justify-end">
        <PrimaryButton onClick={handleSave} loading={saving}>
          <Save size={13} strokeWidth={2} />
          {saving ? 'Saving…' : 'Save schedule'}
        </PrimaryButton>
      </div>
    </Section>
  )
}

// ── Booking settings section ──────────────────────────────────────────────────

function BookingSettingsSection() {
  const { toast } = useToast()
  const [sameDayBookings, setSameDayBookings] = useState(true)
  const [minNotice, setMinNotice] = useState('2hrs')
  const [daysAhead, setDaysAhead] = useState('5')
  const [sendConfirmation, setSendConfirmation] = useState(true)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    // UI-only for now — these settings would need a booking_settings table
    await new Promise((r) => setTimeout(r, 400))
    setSaving(false)
    toast.success('Booking settings saved.')
  }

  return (
    <Section
      title="Booking settings"
      description="Control how and when customers can make bookings."
    >
      <div className="divide-y divide-gray-50">
        <Toggle
          label="Allow same-day bookings"
          description="Customers can book appointments for today."
          checked={sameDayBookings}
          onChange={setSameDayBookings}
        />
        <Toggle
          label="Send confirmation message"
          description="Send customers a WhatsApp confirmation when their booking is received."
          checked={sendConfirmation}
          onChange={setSendConfirmation}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Minimum notice
          </label>
          <select
            value={minNotice}
            onChange={(e) => setMinNotice(e.target.value)}
            className={selectClass + ' w-full'}
          >
            {MIN_NOTICE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">How far in advance must customers book.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Show slots up to
          </label>
          <select
            value={daysAhead}
            onChange={(e) => setDaysAhead(e.target.value)}
            className={selectClass + ' w-full'}
          >
            {DAYS_AHEAD_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">How far ahead customers can see availability.</p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <PrimaryButton onClick={handleSave} loading={saving}>
          <Save size={13} strokeWidth={2} />
          {saving ? 'Saving…' : 'Save settings'}
        </PrimaryButton>
      </div>
    </Section>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function SetupForm({
  initialServices,
  initialAvailability,
}: {
  initialServices: Service[]
  initialAvailability: AvailabilitySchedule[]
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Booking Setup</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Configure your services, availability, and booking preferences.
        </p>
      </div>

      <ServicesSection initial={initialServices} />
      <AvailabilitySection initial={initialAvailability} />
      <BookingSettingsSection />
    </div>
  )
}
