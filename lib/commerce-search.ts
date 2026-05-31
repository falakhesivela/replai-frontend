export type CommerceKind = 'order' | 'booking'

/** Short reference shown to customers (first 8 chars of UUID). */
export function commerceReference(id: string): string {
  return id.slice(0, 8).toLowerCase()
}

export function appPublicOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  return fromEnv ?? 'https://app.replai.co.za'
}

/** Portal URL encoded in confirmation QR codes (staff scan → lookup). */
export function commercePortalLookupUrl(kind: CommerceKind, id: string): string {
  const ref = commerceReference(id)
  const path = kind === 'order' ? '/portal/ecommerce/orders' : '/portal/bookings'
  return `${appPublicOrigin()}${path}?ref=${encodeURIComponent(ref)}`
}

export function commerceQrImageUrl(kind: CommerceKind, id: string): string {
  const ref = commerceReference(id)
  return `/api/commerce-qr?kind=${kind}&ref=${encodeURIComponent(ref)}`
}

export function formatCommerceReference(id: string): string {
  return `#${commerceReference(id)}`
}

export function normalizeLookupQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, '')
}

export type CommerceLookupRecord = {
  id: string
  customer_name?: string | null
  customer_phone?: string
  customer_email?: string | null
}

export function matchesCommerceLookup(record: CommerceLookupRecord, query: string): boolean {
  const q = normalizeLookupQuery(query)
  if (!q) return true

  const ref = commerceReference(record.id)
  if (ref.startsWith(q) || ref.includes(q)) return true
  if (record.id.toLowerCase().replace(/-/g, '').includes(q.replace(/-/g, ''))) return true

  const name = record.customer_name?.toLowerCase() ?? ''
  if (name.includes(q)) return true

  const phone = (record.customer_phone ?? '').replace(/\s/g, '')
  const phoneQ = q.replace(/\s/g, '')
  if (phone && phoneQ && phone.includes(phoneQ)) return true

  const email = record.customer_email?.toLowerCase() ?? ''
  if (email.includes(q)) return true

  return false
}

export function findByCommerceLookup<T extends CommerceLookupRecord>(
  records: T[],
  query: string,
): T | undefined {
  const q = normalizeLookupQuery(query)
  if (!q) return undefined
  return records.find((r) => matchesCommerceLookup(r, q))
}
