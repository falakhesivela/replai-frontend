'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import { Clock, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  createMyService,
  deleteMyService,
  getMyBookingSettings,
  getMyPaymentAccount,
  setMyAvailability,
  updateMyBookingSettings,
  updateMyService,
  type TokenGetter,
} from '@/lib/api'
import { useToast } from '@/components/toast'
import type {
  AvailabilitySchedule,
  BookingPaymentPolicy,
  DepositType,
  SchedulingMode,
  Service,
  ServiceBookingProfile,
} from '@/lib/types'
import { Card, buttonClasses } from '@/components/ui'
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
  price: string
  payment_policy: BookingPaymentPolicy
  deposit_type: DepositType
  deposit_value: string
  use_workspace_defaults: boolean
  ask_guest_count: boolean
  scheduling_mode: SchedulingMode
  daily_capacity: string
  max_guests_per_day: string
}

const EMPTY_SERVICE_FORM: ServiceForm = {
  name: '',
  duration_minutes: 30,
  description: '',
  price: '',
  payment_policy: 'optional',
  deposit_type: 'percent',
  deposit_value: '',
  use_workspace_defaults: true,
  ask_guest_count: false,
  scheduling_mode: 'slot',
  daily_capacity: '1',
  max_guests_per_day: '',
}

function parseDailyCapacity(value: string): number {
  const n = parseInt(value, 10)
  if (Number.isNaN(n) || n < 1) return 1
  return Math.min(99, n)
}

function parseMaxGuestsPerDay(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = parseInt(trimmed, 10)
  if (Number.isNaN(n) || n < 1) return null
  return Math.min(500, n)
}

function priceIsPositive(price: string): boolean {
  const n = parseFloat(price)
  return !Number.isNaN(n) && n > 0
}

/** Per-service payment fields for the API. Cleared when the service is free. */
function servicePaymentPayload(form: ServiceForm): {
  payment_policy: BookingPaymentPolicy
  deposit_type: DepositType | null
  deposit_value: number | null
} {
  if (!priceIsPositive(form.price)) {
    return { payment_policy: 'none', deposit_type: null, deposit_value: null }
  }
  if (form.payment_policy === 'deposit') {
    const val = parseFloat(form.deposit_value)
    return {
      payment_policy: 'deposit',
      deposit_type: form.deposit_type,
      deposit_value: !Number.isNaN(val) && val > 0 ? val : null,
    }
  }
  return { payment_policy: form.payment_policy, deposit_type: null, deposit_value: null }
}

function bookingProfilePayload(form: ServiceForm): ServiceBookingProfile {
  if (form.use_workspace_defaults) {
    return {
      use_workspace_defaults: true,
      ask_guest_count: false,
    }
  }
  return {
    use_workspace_defaults: false,
    ask_guest_count: form.ask_guest_count,
    scheduling_mode: form.scheduling_mode,
    daily_capacity: parseDailyCapacity(form.daily_capacity),
    max_guests_per_day: parseMaxGuestsPerDay(form.max_guests_per_day),
  }
}

function serviceFormFromService(svc: Service): ServiceForm {
  const bp = svc.booking_profile
  return {
    name: svc.name,
    duration_minutes: svc.duration_minutes,
    description: svc.description ?? '',
    price: svc.price != null && Number(svc.price) > 0 ? String(svc.price) : '',
    payment_policy: svc.payment_policy ?? 'optional',
    deposit_type: svc.deposit_type ?? 'percent',
    deposit_value: svc.deposit_value != null ? String(svc.deposit_value) : '',
    use_workspace_defaults: bp?.use_workspace_defaults ?? true,
    ask_guest_count: bp?.ask_guest_count ?? false,
    scheduling_mode:
      bp?.scheduling_mode === 'date_range'
        ? 'date_range'
        : bp?.scheduling_mode === 'date_only'
          ? 'date_only'
          : 'slot',
    daily_capacity: String(bp?.daily_capacity ?? 1),
    max_guests_per_day:
      bp?.max_guests_per_day != null ? String(bp.max_guests_per_day) : '',
  }
}

function servicePaymentSummary(svc: Service): string | null {
  if (svc.price == null || Number(svc.price) <= 0) return null
  if (svc.payment_policy === 'full') return 'Prepay required'
  if (svc.payment_policy === 'deposit') {
    if (svc.deposit_value != null && Number(svc.deposit_value) > 0) {
      return svc.deposit_type === 'fixed'
        ? `Deposit R${Number(svc.deposit_value).toFixed(2)}`
        : `Deposit ${Number(svc.deposit_value)}%`
    }
    return 'Deposit required'
  }
  return null
}

function schedulingModeLabel(mode: SchedulingMode): string {
  if (mode === 'date_range') return 'Overnight stays'
  if (mode === 'date_only') return 'Full day'
  return 'Appointments'
}

function serviceIntakeSummary(svc: Service): string {
  const bp = svc.booking_profile
  if (!bp || bp.use_workspace_defaults) return 'Uses workspace booking rules'
  const mode: SchedulingMode =
    bp.scheduling_mode === 'date_range'
      ? 'date_range'
      : bp.scheduling_mode === 'date_only'
        ? 'date_only'
        : 'slot'
  const parts: string[] = [schedulingModeLabel(mode)]
  if (bp.daily_capacity && bp.daily_capacity > 1) {
    parts.push(`capacity ${bp.daily_capacity}/day`)
  }
  if (bp.max_guests_per_day && bp.max_guests_per_day > 0) {
    parts.push(`max ${bp.max_guests_per_day} guests/day`)
  }
  if (bp.ask_guest_count) parts.push('asks for guest count')
  return parts.join(', ')
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

const SCHEDULING_MODE_OPTIONS: { value: SchedulingMode; label: string; description: string }[] = [
  {
    value: 'slot',
    label: 'Appointments',
    description: 'Customers pick a date and time slot (salons, clinics).',
  },
  {
    value: 'date_only',
    label: 'Full day',
    description: 'Customers pick a date only — one booking per day (tours, day passes).',
  },
  {
    value: 'date_range',
    label: 'Overnight stays',
    description: 'Customers pick check-in and check-out dates (guesthouses, hotels).',
  },
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
  'w-full rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25'

const selectClass =
  'rounded-md border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25'

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
    <Card>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-0.5 mb-5 text-xs text-ink-2">{description}</p>}
      {!description && <div className="mb-5" />}
      {children}
    </Card>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <div className="py-3">
      <label className="block text-sm font-medium text-ink-2 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={selectClass + ' w-full'}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink-2">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        } ${checked ? 'bg-accent' : 'bg-line'}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-surface shadow transition-transform ${
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
      className={buttonClasses()}
    >
      {loading && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  )
}

function ServiceBookingProfileFields({
  form,
  setForm,
}: {
  form: ServiceForm
  setForm: Dispatch<SetStateAction<ServiceForm>>
}) {
  return (
    <div className="space-y-2 rounded-md border border-line bg-surface p-3">
      <p className="text-xs font-medium text-ink-2">Booking questions</p>
      <Toggle
        label="Use workspace defaults"
        description="Inherit guest-count and other rules from Booking settings below."
        checked={form.use_workspace_defaults}
        onChange={(v) =>
          setForm((f) => ({
            ...f,
            use_workspace_defaults: v,
            ask_guest_count: v ? false : f.ask_guest_count,
          }))
        }
      />
      {!form.use_workspace_defaults && (
        <>
          <SelectField
            label="Scheduling"
            value={form.scheduling_mode}
            onChange={(v) =>
              setForm((f) => ({ ...f, scheduling_mode: v as SchedulingMode }))
            }
            options={SCHEDULING_MODE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
          />
          <p className="text-[11px] text-ink-2">
            {SCHEDULING_MODE_OPTIONS.find((o) => o.value === form.scheduling_mode)?.description}
          </p>
          <div className="py-1">
            <label className="block text-sm font-medium text-ink-2 mb-1.5">
              Daily capacity
            </label>
            <input
              type="number"
              min={1}
              max={99}
              value={form.daily_capacity}
              onChange={(e) =>
                setForm((f) => ({ ...f, daily_capacity: e.target.value }))
              }
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-ink-2">
              Max bookings per day for full-day and stay services (e.g. 3 rooms).
            </p>
          </div>
          {form.ask_guest_count && (
            <div className="py-1">
              <label className="block text-sm font-medium text-ink-2 mb-1.5">
                Max guests per day
              </label>
              <input
                type="number"
                min={1}
                max={500}
                placeholder="No limit"
                value={form.max_guests_per_day}
                onChange={(e) =>
                  setForm((f) => ({ ...f, max_guests_per_day: e.target.value }))
                }
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-ink-2">
                Total guests allowed across all bookings on the same day (leave empty for no limit).
              </p>
            </div>
          )}
          <Toggle
            label="Ask for number of guests"
            description="Require a guest count for this service only."
            checked={form.ask_guest_count}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                ask_guest_count: v,
                max_guests_per_day: v ? f.max_guests_per_day : '',
              }))
            }
          />
        </>
      )}
    </div>
  )
}

// The stored `payment_policy` (none|optional|deposit|full) is surfaced as a
// simpler two-level control: a top-level mode, then (for Required) full vs deposit.
type PaymentMode = 'none' | 'optional' | 'required'

function paymentModeOf(policy: BookingPaymentPolicy): PaymentMode {
  if (policy === 'none') return 'none'
  if (policy === 'optional') return 'optional'
  return 'required' // deposit | full
}

const PAYMENT_MODE_OPTIONS: { value: PaymentMode; label: string; description: string }[] = [
  {
    value: 'none',
    label: 'No online payment',
    description: 'Customers book without paying online — arrange payment yourself.',
  },
  {
    value: 'optional',
    label: 'Optional',
    description: 'Booking is confirmed right away; a pay-online link is shared.',
  },
  {
    value: 'required',
    label: 'Required',
    description: 'Booking is held (Reserved) until paid, then auto-confirms.',
  },
]

function ServicePaymentFields({
  form,
  setForm,
  paystackConnected,
  idPrefix,
}: {
  form: ServiceForm
  setForm: Dispatch<SetStateAction<ServiceForm>>
  paystackConnected: boolean
  idPrefix: string
}) {
  // Payment only applies to priced services.
  if (!priceIsPositive(form.price)) return null
  const price = parseFloat(form.price)
  const mode = paymentModeOf(form.payment_policy)

  function setMode(next: PaymentMode) {
    setForm((f) => {
      if (next === 'none') return { ...f, payment_policy: 'none' }
      if (next === 'optional') return { ...f, payment_policy: 'optional' }
      // Required → keep deposit if already chosen, else default to full price.
      return { ...f, payment_policy: f.payment_policy === 'deposit' ? 'deposit' : 'full' }
    })
  }

  let depositPreview: string | null = null
  if (form.payment_policy === 'deposit') {
    const v = parseFloat(form.deposit_value)
    if (!Number.isNaN(v) && v > 0) {
      const amount =
        form.deposit_type === 'percent'
          ? (price * Math.min(v, 100)) / 100
          : Math.min(v, price)
      depositPreview = `Customer pays R${amount.toFixed(2)} now to secure the booking.`
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-line bg-surface p-3">
      <p className="text-xs font-medium text-ink-2">Payment</p>
      <div className="space-y-1.5">
        {PAYMENT_MODE_OPTIONS.map((o) => {
          const disabled = o.value === 'required' && !paystackConnected
          const selected = mode === o.value
          return (
            <label
              key={o.value}
              className={`flex items-start gap-2 rounded-md border p-2 transition-colors ${
                disabled
                  ? 'cursor-not-allowed border-line opacity-60'
                  : selected
                    ? 'cursor-pointer border-accent ring-1 ring-accent'
                    : 'cursor-pointer border-line hover:border-line-strong'
              }`}
            >
              <input
                type="radio"
                name={`${idPrefix}-payment-mode`}
                className="mt-0.5"
                checked={selected}
                disabled={disabled}
                onChange={() => setMode(o.value)}
              />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-ink">{o.label}</span>
                <span className="block text-[11px] text-ink-2">{o.description}</span>
                {disabled && (
                  <span className="mt-0.5 block text-[11px] text-warning">
                    Connect{' '}
                    <Link
                      href="/portal/integrations/paystack"
                      className="underline hover:text-warning"
                    >
                      Paystack
                    </Link>{' '}
                    to require payment.
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </div>

      {mode === 'required' && (
        <div className="space-y-2 rounded-md bg-surface-2 p-2.5">
          <SelectField
            label="How much to collect?"
            value={form.payment_policy === 'deposit' ? 'deposit' : 'full'}
            onChange={(v) =>
              setForm((f) => ({ ...f, payment_policy: v as BookingPaymentPolicy }))
            }
            options={[
              { value: 'full', label: 'Full price' },
              { value: 'deposit', label: 'Deposit only' },
            ]}
          />
          {form.payment_policy === 'deposit' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-ink-2">Deposit amount</label>
              <div className="flex gap-2">
                <select
                  value={form.deposit_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deposit_type: e.target.value as DepositType }))
                  }
                  className={selectClass}
                >
                  <option value="percent">% of price</option>
                  <option value="fixed">Fixed (R)</option>
                </select>
                <input
                  type="number"
                  min="0"
                  step={form.deposit_type === 'percent' ? '1' : '0.01'}
                  value={form.deposit_value}
                  onChange={(e) => setForm((f) => ({ ...f, deposit_value: e.target.value }))}
                  placeholder={form.deposit_type === 'percent' ? 'e.g. 20' : 'e.g. 500'}
                  className={inputClass}
                />
              </div>
              {depositPreview && <p className="text-[11px] text-ink-2">{depositPreview}</p>}
            </div>
          )}
        </div>
      )}
    </div>
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
  const [form, setForm] = useState<ServiceForm>(EMPTY_SERVICE_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ServiceForm>(EMPTY_SERVICE_FORM)
  const [saving, setSaving] = useState(false)
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Gates the "Required" payment option — you can't enforce payment without it.
  const [paystackConnected, setPaystackConnected] = useState(false)

  useEffect(() => {
    getMyPaymentAccount(getFreshToken)
      .then((acct) => setPaystackConnected(acct?.status === 'active'))
      .catch(() => setPaystackConnected(false))
  }, [])

  function resetForm() {
    setForm(EMPTY_SERVICE_FORM)
    setShowForm(false)
  }

  function startEdit(svc: Service) {
    setEditingId(svc.id)
    setEditForm(serviceFormFromService(svc))
    setShowForm(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(EMPTY_SERVICE_FORM)
  }

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const priceNum = form.price.trim() ? parseFloat(form.price) : null
      const created = await createMyService(getFreshToken, {
        name: form.name.trim(),
        duration_minutes: form.duration_minutes,
        description: form.description.trim() || null,
        price: priceNum != null && !Number.isNaN(priceNum) ? priceNum : null,
        currency: 'ZAR',
        booking_profile: bookingProfilePayload(form),
        ...servicePaymentPayload(form),
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

  async function handleSaveEdit(serviceId: string) {
    if (!editForm.name.trim()) return
    setSavingEditId(serviceId)
    try {
      const priceNum = editForm.price.trim() ? parseFloat(editForm.price) : null
      const updated = await updateMyService(getFreshToken, serviceId, {
        name: editForm.name.trim(),
        duration_minutes: editForm.duration_minutes,
        description: editForm.description.trim() || null,
        price: priceNum != null && !Number.isNaN(priceNum) ? priceNum : null,
        booking_profile: bookingProfilePayload(editForm),
        ...servicePaymentPayload(editForm),
      })
      setServices((prev) => prev.map((s) => (s.id === serviceId ? updated : s)))
      cancelEdit()
      toast.success('Service updated.')
    } catch {
      toast.error('Failed to update service.')
    } finally {
      setSavingEditId(null)
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
        <ul className="mb-4 divide-y divide-line rounded-md border border-line">
          {services.map((svc) => {
            const dur = DURATION_OPTIONS.find((d) => d.value === svc.duration_minutes)?.label
              ?? `${svc.duration_minutes} min`
            const isEditing = editingId === svc.id
            return (
              <li key={svc.id} className="px-4 py-3">
                {isEditing ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                      Edit service
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">Duration</label>
                      <select
                        value={editForm.duration_minutes}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))
                        }
                        className={selectClass}
                      >
                        {DURATION_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">
                        Price (ZAR){' '}
                        <span className="text-ink-3">(leave empty for free)</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.price}
                        onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                        placeholder="0.00"
                        className={inputClass}
                      />
                    </div>
                    <ServicePaymentFields
                      form={editForm}
                      setForm={setEditForm}
                      paystackConnected={paystackConnected}
                      idPrefix={`edit-${svc.id}`}
                    />
                    <ServiceBookingProfileFields form={editForm} setForm={setEditForm} />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-surface"
                      >
                        Cancel
                      </button>
                      <PrimaryButton
                        onClick={() => handleSaveEdit(svc.id)}
                        loading={savingEditId === svc.id}
                        disabled={!editForm.name.trim()}
                      >
                        Save
                      </PrimaryButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{svc.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs text-ink-3">
                          <Clock size={11} strokeWidth={1.75} />
                          {dur}
                        </span>
                        {svc.price != null && Number(svc.price) > 0 && (
                          <span className="text-xs font-medium text-ink-2">
                            R{Number(svc.price).toFixed(2)}
                          </span>
                        )}
                        {servicePaymentSummary(svc) && (
                          <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 ring-1 ring-orange-200">
                            {servicePaymentSummary(svc)}
                          </span>
                        )}
                        <span className="text-xs text-accent-text">{serviceIntakeSummary(svc)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(svc)}
                        className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink-2 transition-colors"
                        aria-label="Edit service"
                      >
                        <Pencil size={14} strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(svc.id)}
                        disabled={deletingId === svc.id}
                        className="rounded-md p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger disabled:opacity-40 transition-colors"
                        aria-label="Delete service"
                      >
                        {deletingId === svc.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} strokeWidth={1.75} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Inline add form */}
      {showForm ? (
        <div className="rounded-md border border-line bg-surface-2 p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">New service</p>
            <button
              type="button"
              onClick={resetForm}
              className="rounded p-0.5 text-ink-3 hover:text-ink-2 transition-colors"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">Service name</label>
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
            <label className="block text-xs font-medium text-ink-2 mb-1">Duration</label>
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
            <label className="block text-xs font-medium text-ink-2 mb-1">
              Price (ZAR) <span className="text-ink-3">(optional — leave empty for free)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="0.00"
              className={inputClass}
            />
          </div>

          <ServicePaymentFields
            form={form}
            setForm={setForm}
            paystackConnected={paystackConnected}
            idPrefix="new"
          />

          <div>
            <label className="block text-xs font-medium text-ink-2 mb-1">
              Description <span className="text-ink-3">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description for customers…"
              rows={2}
              className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </div>

          <ServiceBookingProfileFields form={form} setForm={setForm} />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-surface transition-colors"
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
          className="flex items-center gap-1.5 rounded-md border border-dashed border-line-strong px-3 py-2 text-sm text-ink-2 hover:border-line-strong hover:text-ink-2 transition-colors"
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
      <div className="divide-y divide-line rounded-md border border-line mb-4 overflow-hidden">
        {rows.map((row) => (
          <div
            key={row.day_of_week}
            className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors ${
              row.enabled ? 'bg-surface' : 'bg-surface-2'
            }`}
          >
            {/* Day toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={row.enabled}
              onClick={() => updateRow(row.day_of_week, { enabled: !row.enabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 ${
                row.enabled ? 'bg-accent' : 'bg-line'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-surface shadow transition-transform ${
                  row.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>

            {/* Day label */}
            <span
              className={`w-24 text-sm font-medium ${
                row.enabled ? 'text-ink' : 'text-ink-3'
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
                <span className="text-xs text-ink-3">to</span>
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
              <span className="text-xs text-ink-3 italic">Unavailable</span>
            )}
          </div>
        ))}
      </div>

      {/* Preview */}
      <p className={`mb-4 text-xs ${enabledDays === 0 ? 'text-warning' : 'text-ink-2'}`}>
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
  const [askGuestCount, setAskGuestCount] = useState(false)
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>('slot')
  const [dailyCapacity, setDailyCapacity] = useState('1')
  const [maxGuestsPerDay, setMaxGuestsPerDay] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const settings = await getMyBookingSettings(getFreshToken)
        if (cancelled) return
        setSameDayBookings(settings.same_day_allowed)
        setMinNotice(settings.min_notice)
        setDaysAhead(String(settings.days_ahead))
        setSendConfirmation(settings.send_confirmation)
        setAskGuestCount(settings.ask_guest_count)
        setSchedulingMode(
          settings.scheduling_mode === 'date_range'
            ? 'date_range'
            : settings.scheduling_mode === 'date_only'
              ? 'date_only'
              : 'slot',
        )
        setDailyCapacity(String(settings.daily_capacity ?? 1))
        setMaxGuestsPerDay(
          settings.max_guests_per_day != null ? String(settings.max_guests_per_day) : '',
        )
      } catch {
        if (!cancelled) toast.error('Failed to load booking settings.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [toast])

  async function handleSave() {
    setSaving(true)
    try {
      const days = parseInt(daysAhead, 10)
      await updateMyBookingSettings(getFreshToken, {
        same_day_allowed: sameDayBookings,
        min_notice: minNotice,
        days_ahead: Number.isNaN(days) ? 5 : days,
        send_confirmation: sendConfirmation,
        ask_guest_count: askGuestCount,
        scheduling_mode: schedulingMode,
        daily_capacity: parseDailyCapacity(dailyCapacity),
        max_guests_per_day: askGuestCount ? parseMaxGuestsPerDay(maxGuestsPerDay) : null,
      })
      toast.success('Booking settings saved.')
    } catch {
      toast.error('Failed to save booking settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      title="Booking settings"
      description="Control how and when customers can make bookings."
    >
      <div className="divide-y divide-line/60">
        <Toggle
          label="Allow same-day bookings"
          description="Customers can book appointments for today."
          checked={sameDayBookings}
          onChange={setSameDayBookings}
          disabled={loading}
        />
        <Toggle
          label="Send confirmation email"
          description="When the customer provides an email at checkout, send a booking confirmation message."
          checked={sendConfirmation}
          onChange={setSendConfirmation}
          disabled={loading}
        />
        <SelectField
          label="Default scheduling"
          value={schedulingMode}
          onChange={(v) => setSchedulingMode(v as SchedulingMode)}
          options={SCHEDULING_MODE_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          disabled={loading}
        />
        <p className="px-5 pb-2 text-[11px] text-ink-2">
          {SCHEDULING_MODE_OPTIONS.find((o) => o.value === schedulingMode)?.description}
        </p>
        <div className="px-5 pb-3">
          <label className="block text-sm font-medium text-ink-2 mb-1.5">
            Daily capacity
          </label>
          <input
            type="number"
            min={1}
            max={99}
            value={dailyCapacity}
            onChange={(e) => setDailyCapacity(e.target.value)}
            disabled={loading}
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-ink-2">
            For full-day and overnight services: how many bookings or rooms can be sold per day
            (1 = exclusive).
          </p>
        </div>
        <Toggle
          label="Ask for number of guests"
          description="Require customers to say how many people before confirming (guesthouses, tours, restaurants)."
          checked={askGuestCount}
          onChange={(v) => {
            setAskGuestCount(v)
            if (!v) setMaxGuestsPerDay('')
          }}
          disabled={loading}
        />
        {askGuestCount && (
          <div className="px-5 pb-3">
            <label className="block text-sm font-medium text-ink-2 mb-1.5">
              Max guests per day
            </label>
            <input
              type="number"
              min={1}
              max={500}
              placeholder="No limit"
              value={maxGuestsPerDay}
              onChange={(e) => setMaxGuestsPerDay(e.target.value)}
              disabled={loading}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-ink-2">
              Sum of guest counts on the same calendar day (e.g. 40 for a restaurant).
              Leave empty to only use booking/room capacity above.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">
            Minimum notice
          </label>
          <select
            value={minNotice}
            onChange={(e) => setMinNotice(e.target.value)}
            disabled={loading}
            className={selectClass + ' w-full'}
          >
            {MIN_NOTICE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-3">How far in advance must customers book.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1.5">
            Show slots up to
          </label>
          <select
            value={daysAhead}
            onChange={(e) => setDaysAhead(e.target.value)}
            disabled={loading}
            className={selectClass + ' w-full'}
          >
            {DAYS_AHEAD_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-3">How far ahead customers can see availability.</p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <PrimaryButton onClick={handleSave} loading={saving} disabled={loading}>
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
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Booking Setup</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          Configure your services, availability, and booking preferences.
        </p>
      </div>

      <ServicesSection initial={initialServices} />
      <AvailabilitySection initial={initialAvailability} />
      <BookingSettingsSection />
    </div>
  )
}
