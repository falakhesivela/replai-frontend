import { hasPortalPermission, type PortalRole } from '@/lib/portal-permissions'

/** Single permission or any-of (e.g. settings: full vs account-only). */
export type PortalNavEntry =
  | { href: string; permission: string }
  | { href: string; anyPermission: readonly string[] }

export const PORTAL_NAV_ACCESS: readonly PortalNavEntry[] = [
  { href: '/portal/overview', permission: 'view_analytics' },
  { href: '/portal/analytics', permission: 'view_analytics' },
  /** Agents use read-only My Agent; editing requires `manage_agent`. */
  { href: '/portal/my-agent', permission: 'view_conversations' },
  { href: '/portal/knowledge-base', permission: 'manage_agent' },
  { href: '/portal/playground', permission: 'manage_agent' },
  { href: '/portal/chatbot-widget', permission: 'manage_agent' },
  { href: '/portal/conversations', permission: 'view_conversations' },
  { href: '/portal/leads', permission: 'view_leads' },
  { href: '/portal/bookings', permission: 'view_bookings' },
  { href: '/portal/my-bookings', permission: 'view_bookings' },
  { href: '/portal/broadcasts', permission: 'manage_broadcasts' },
  { href: '/portal/team', permission: 'manage_team' },
  { href: '/portal/team/roles', permission: 'manage_team' },
  { href: '/portal/setup', permission: 'manage_settings' },
  {
    href: '/portal/settings',
    anyPermission: ['manage_settings', 'view_settings'],
  },
  { href: '/portal/integrations', permission: 'manage_subscription' },
  { href: '/portal/subscription', permission: 'manage_subscription' },
  { href: '/portal/ecommerce/products', permission: 'manage_ecommerce' },
  { href: '/portal/ecommerce/orders', permission: 'manage_ecommerce' },
]

export function portalNavEntryAllowsRole(
  role: PortalRole,
  entry: PortalNavEntry
): boolean {
  if ('anyPermission' in entry) {
    return entry.anyPermission.some((p) => hasPortalPermission(role, p))
  }
  return hasPortalPermission(role, entry.permission)
}
