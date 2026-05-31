'use client'

import { useState } from 'react'
import { Calendar, Clock, Loader2 } from 'lucide-react'
import { CommerceConfirmationReference } from '@/components/commerce-confirmation-reference'
import type { WidgetAction, WidgetComponent } from '@/lib/api'
import { formatBookingDetailRows } from '@/lib/booking-details'
import { formatWidgetMoney } from './widget-shopping'

export type BookingConfirmationData = Extract<
  WidgetComponent,
  { type: 'booking_confirmation' }
>

export type BookingIntakeFormData = Extract<
  WidgetComponent,
  { type: 'booking_intake_form' }
>

export function inlineBookingComponents(
  components?: WidgetComponent[],
): WidgetComponent[] {
  if (!components?.length) return []
  return components.filter(
    (c) =>
      c.type === 'service_list' ||
      c.type === 'date_picker' ||
      c.type === 'time_slots' ||
      c.type === 'booking_intake_form' ||
      c.type === 'booking_confirmation',
  )
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function ServiceListCard({
  services,
  brandColor,
  onBrand,
  disabled,
  onSelect,
}: {
  services: Extract<WidgetComponent, { type: 'service_list' }>['services']
  brandColor: string
  onBrand: string
  disabled: boolean
  onSelect: (serviceId: string, name: string) => void
}) {
  if (!services.length) return null
  return (
    <div className="mt-2 max-w-[95%] space-y-2">
      <p className="pl-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        Services
      </p>
      <div className="grid gap-2">
        {services.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-900">{s.name}</p>
            {s.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{s.description}</p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              {s.duration_minutes > 0 && (
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {formatDuration(s.duration_minutes)}
                </span>
              )}
              {s.price != null && s.price > 0 && (
                <span>{formatWidgetMoney(s.currency, s.price)}</span>
              )}
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(s.id, s.name)}
              className="mt-2 w-full rounded-lg py-2 text-xs font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: brandColor, color: onBrand }}
            >
              Select
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DatePickerCard({
  comp,
  brandColor,
  onBrand,
  disabled,
  onSelect,
}: {
  comp: Extract<WidgetComponent, { type: 'date_picker' }>
  brandColor: string
  onBrand: string
  disabled: boolean
  onSelect: (date: string) => void
}) {
  if (!comp.dates.length) return null
  const title =
    comp.purpose === 'check_in'
      ? `Check-in — ${comp.service_name}`
      : comp.purpose === 'check_out'
        ? `Check-out (from ${comp.check_in_label ?? comp.check_in ?? 'check-in'})`
        : comp.purpose === 'day'
          ? `Pick a date — ${comp.service_name}`
          : comp.service_name
            ? `Dates — ${comp.service_name}`
            : 'Pick a date'
  return (
    <div className="mt-2 max-w-[95%] space-y-2">
      <p className="pl-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {comp.dates.map((d) => (
          <button
            key={d.date}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(d.date)}
            className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 transition-opacity hover:border-gray-300 disabled:opacity-50"
          >
            <Calendar size={12} className="text-gray-400" />
            {d.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TimeSlotsCard({
  comp,
  brandColor,
  onBrand,
  disabled,
  onSelect,
}: {
  comp: Extract<WidgetComponent, { type: 'time_slots' }>
  brandColor: string
  onBrand: string
  disabled: boolean
  onSelect: (time: string) => void
}) {
  if (!comp.slots.length) return null
  return (
    <div className="mt-2 max-w-[95%] space-y-2">
      <p className="pl-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        Times — {comp.date_label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {comp.slots.map((slot) => (
          <button
            key={slot.time}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(slot.time)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: brandColor, color: onBrand }}
          >
            {slot.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function BookingIntakeFormCard({
  comp,
  brandColor,
  onBrand,
  disabled,
  busy,
  onSubmit,
}: {
  comp: BookingIntakeFormData
  brandColor: string
  onBrand: string
  disabled: boolean
  busy: boolean
  onSubmit: (details: Record<string, string | number>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of comp.fields) {
      if (f.type === 'integer' && f.min != null) {
        init[f.key] = String(f.min)
      } else {
        init[f.key] = ''
      }
    }
    return init
  })
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    const details: Record<string, string | number> = {}
    for (const field of comp.fields) {
      const raw = values[field.key]?.trim() ?? ''
      if (!raw) {
        if (field.required) {
          setError(`${field.label} is required.`)
          return
        }
        continue
      }
      if (field.type === 'integer') {
        const num = parseInt(raw, 10)
        if (Number.isNaN(num)) {
          setError(`${field.label} must be a whole number.`)
          return
        }
        if (field.min != null && num < field.min) {
          setError(`${field.label} must be at least ${field.min}.`)
          return
        }
        if (field.max != null && num > field.max) {
          setError(`${field.label} must be at most ${field.max}.`)
          return
        }
        details[field.key] = num
      } else {
        details[field.key] = raw
      }
    }
    setError(null)
    const payload = { ...details }
    if (comp.check_out) payload.check_out = comp.check_out
    onSubmit(payload)
  }

  return (
    <div className="mt-2 max-w-[95%] rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <p className="text-sm font-medium text-gray-900">Booking details</p>
      <p className="mt-0.5 text-xs text-gray-500">
        {comp.service_name} · {comp.date_label} at {comp.time_label}
      </p>
      <div className="mt-3 space-y-3">
        {comp.fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {field.label}
              {field.required ? ' *' : ''}
            </label>
            <input
              type={field.type === 'integer' ? 'number' : 'text'}
              inputMode={field.type === 'integer' ? 'numeric' : 'text'}
              min={field.min ?? undefined}
              max={field.max ?? undefined}
              value={values[field.key] ?? ''}
              disabled={disabled || busy}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50"
            />
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button
        type="button"
        disabled={disabled || busy}
        onClick={handleSubmit}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ backgroundColor: brandColor, color: onBrand }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        Continue
      </button>
    </div>
  )
}

export function BookingConfirmationCard({
  comp,
  brandColor,
  onBrand,
  disabled,
  busy,
  onConfirm,
}: {
  comp: BookingConfirmationData
  brandColor: string
  onBrand: string
  disabled: boolean
  busy: boolean
  onConfirm?: () => void
}) {
  const isPreview = comp.status === 'preview'
  const detailRows = formatBookingDetailRows(comp.booking_details ?? undefined)

  return (
    <div
      className={`mt-2 max-w-[95%] rounded-xl border p-3 shadow-sm ${
        isPreview
          ? 'border-indigo-100 bg-indigo-50/50'
          : 'border-emerald-100 bg-emerald-50/80'
      }`}
    >
      <p className="text-sm font-medium text-gray-900">
        {isPreview ? 'Confirm appointment' : 'Booking confirmed'}
      </p>
      {!isPreview && comp.booking_id && (
        <CommerceConfirmationReference
          id={comp.booking_id}
          kind="booking"
          arrivalHint="Show this QR code or reference when you arrive"
        />
      )}
      <dl className="mt-2 space-y-1 text-sm text-gray-700">
        <div>
          <dt className="text-xs text-gray-500">Service</dt>
          <dd className="font-medium">{comp.service_name}</dd>
        </div>
        {comp.check_out_label ? (
          <>
            <div>
              <dt className="text-xs text-gray-500">Check-in</dt>
              <dd>{comp.date_label}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Check-out</dt>
              <dd>{comp.check_out_label}</dd>
            </div>
          </>
        ) : comp.time_label === 'All day' ? (
          <div>
            <dt className="text-xs text-gray-500">Date</dt>
            <dd>{comp.date_label}</dd>
          </div>
        ) : (
          <div>
            <dt className="text-xs text-gray-500">When</dt>
            <dd>
              {comp.date_label} at {comp.time_label}
            </dd>
          </div>
        )}
        {detailRows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-gray-500">{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        {comp.price != null && comp.price > 0 && (
          <div>
            <dt className="text-xs text-gray-500">Price</dt>
            <dd>{formatWidgetMoney(comp.currency, comp.price)}</dd>
          </div>
        )}
      </dl>
      {isPreview && onConfirm && (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={onConfirm}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ backgroundColor: brandColor, color: onBrand }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          Confirm booking
        </button>
      )}
      {!isPreview && comp.payment_link && (
        <a
          href={comp.payment_link}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 flex w-full items-center justify-center rounded-lg py-2.5 text-sm font-semibold no-underline transition-opacity hover:opacity-90"
          style={{ backgroundColor: brandColor, color: onBrand }}
        >
          Pay now
        </a>
      )}
    </div>
  )
}

export function WidgetBookingMessageComponents({
  components,
  brandColor,
  onBrand,
  disabled,
  busy,
  onSelectService,
  onSelectDate,
  onSelectTime,
  onSubmitBookingDetails,
  onConfirmBooking,
}: {
  components: WidgetComponent[]
  brandColor: string
  onBrand: string
  disabled: boolean
  busy: boolean
  onSelectService: (serviceId: string, name: string) => void
  onSelectDate: (
    comp: Extract<WidgetComponent, { type: 'date_picker' }>,
    date: string,
  ) => void
  onSelectTime: (serviceId: string, date: string, time: string) => void
  onSubmitBookingDetails: (
    comp: BookingIntakeFormData,
    details: Record<string, string | number>,
  ) => void
  onConfirmBooking: (comp: BookingConfirmationData) => void
}) {
  return (
    <>
      {components.map((comp, idx) => {
        if (comp.type === 'service_list') {
          return (
            <ServiceListCard
              key={`svc-${idx}`}
              services={comp.services}
              brandColor={brandColor}
              onBrand={onBrand}
              disabled={disabled}
              onSelect={onSelectService}
            />
          )
        }
        if (comp.type === 'date_picker') {
          return (
            <DatePickerCard
              key={`date-${idx}`}
              comp={comp}
              brandColor={brandColor}
              onBrand={onBrand}
              disabled={disabled}
              onSelect={(date) => onSelectDate(comp, date)}
            />
          )
        }
        if (comp.type === 'time_slots') {
          return (
            <TimeSlotsCard
              key={`time-${idx}`}
              comp={comp}
              brandColor={brandColor}
              onBrand={onBrand}
              disabled={disabled}
              onSelect={(time) => onSelectTime(comp.service_id, comp.date, time)}
            />
          )
        }
        if (comp.type === 'booking_intake_form') {
          return (
            <BookingIntakeFormCard
              key={`intake-${idx}`}
              comp={comp}
              brandColor={brandColor}
              onBrand={onBrand}
              disabled={disabled}
              busy={busy}
              onSubmit={(details) => onSubmitBookingDetails(comp, details)}
            />
          )
        }
        if (comp.type === 'booking_confirmation') {
          return (
            <BookingConfirmationCard
              key={`book-${idx}`}
              comp={comp}
              brandColor={brandColor}
              onBrand={onBrand}
              disabled={disabled}
              busy={busy}
              onConfirm={
                comp.status === 'preview'
                  ? () => onConfirmBooking(comp)
                  : undefined
              }
            />
          )
        }
        return null
      })}
    </>
  )
}

export function bookingActionUserLabel(
  action: WidgetAction,
  serviceName?: string,
): string {
  switch (action.type) {
    case 'browse_services':
      return 'Browse services'
    case 'select_service':
      return serviceName ? `Book ${serviceName}` : 'Select service'
    case 'select_date':
      return 'Select date'
    case 'select_time':
      return 'Select time'
    case 'submit_booking_details':
      return 'Continue booking'
    case 'confirm_booking':
      return 'Confirm booking'
    default:
      return ''
  }
}
