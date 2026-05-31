/** Display labels for booking_details keys (portal / widget). */

const KNOWN_LABELS: Record<string, string> = {
  guests: 'Number of guests',
  check_out: 'Check-out',
}

function formatIsoDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return value
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatBookingDetailRows(
  details: Record<string, unknown> | null | undefined
): { label: string; value: string }[] {
  if (!details || typeof details !== 'object') return []
  return Object.entries(details)
    .filter(([key, v]) => key !== 'check_out' && v !== null && v !== undefined && v !== '')
    .map(([key, value]) => ({
      label: KNOWN_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: key === 'check_out' ? formatIsoDate(String(value)) : String(value),
    }))
}

export function stayRangeFromBooking(
  bookingDate: string,
  details: Record<string, unknown> | null | undefined
): { checkInLabel: string; checkOutLabel: string } | null {
  const checkOut = details?.check_out
  if (!checkOut || typeof checkOut !== 'string') return null
  return {
    checkInLabel: formatIsoDate(bookingDate),
    checkOutLabel: formatIsoDate(checkOut),
  }
}
