/** Public marketing site — legal pages and pricing live here (not the app subdomain). */
export const MARKETING_SITE_URL =
  process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.replace(/\/$/, '') ??
  'https://replai.co.za'

export const LEGAL_LINKS = [
  { label: 'Terms', href: `${MARKETING_SITE_URL}/terms` },
  { label: 'Privacy', href: `${MARKETING_SITE_URL}/privacy` },
  { label: 'Refund policy', href: `${MARKETING_SITE_URL}/refund` },
] as const
