'use client'

import { Calendar, Clock, Loader2 } from 'lucide-react'
import type { WidgetAction, WidgetComponent } from '@/lib/api'
import { formatWidgetMoney } from './widget-shopping'

export type BookingConfirmationData = Extract<
  WidgetComponent,
  { type: 'booking_confirmation' }
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
  return (
    <div className="mt-2 max-w-[95%] space-y-2">
      <p className="pl-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {comp.service_name ? `Dates — ${comp.service_name}` : 'Pick a date'}
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
  const shortRef = comp.booking_id ? comp.booking_id.slice(0, 8) : ''

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
      {!isPreview && shortRef && (
        <p className="mt-0.5 text-xs text-gray-500">Reference #{shortRef}</p>
      )}
      <dl className="mt-2 space-y-1 text-sm text-gray-700">
        <div>
          <dt className="text-xs text-gray-500">Service</dt>
          <dd className="font-medium">{comp.service_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">When</dt>
          <dd>
            {comp.date_label} at {comp.time_label}
          </dd>
        </div>
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
  onConfirmBooking,
}: {
  components: WidgetComponent[]
  brandColor: string
  onBrand: string
  disabled: boolean
  busy: boolean
  onSelectService: (serviceId: string, name: string) => void
  onSelectDate: (serviceId: string, date: string) => void
  onSelectTime: (serviceId: string, date: string, time: string) => void
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
              onSelect={(date) => onSelectDate(comp.service_id, date)}
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
    case 'confirm_booking':
      return 'Confirm booking'
    default:
      return ''
  }
}
