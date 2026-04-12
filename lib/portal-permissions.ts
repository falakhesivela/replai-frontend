/**
 * Portal role permissions — single source of truth for UI and server-side checks.
 * Mirrors `app/team_auth.py` PERMISSIONS.
 */
export type PortalRole = 'owner' | 'manager' | 'agent'

export const PERMISSIONS_BY_ROLE: Record<PortalRole, readonly string[]> = {
  owner: [
    'manage_team',
    'manage_billing',
    'manage_settings',
    'view_analytics',
    'manage_agent',
    'view_conversations',
    'reply_conversations',
    'assign_conversations',
    'view_leads',
    'manage_leads',
    'view_bookings',
    'manage_bookings',
    'manage_broadcasts',
  ],
  manager: [
    'manage_team',
    'view_analytics',
    'view_conversations',
    'reply_conversations',
    'assign_conversations',
    'view_leads',
    'manage_leads',
    'view_bookings',
    'manage_bookings',
    'manage_broadcasts',
  ],
  agent: [
    'view_conversations',
    'reply_conversations',
    'view_leads',
    'view_bookings',
    /** Account + password in portal settings (UI limits the rest). */
    'view_settings',
  ],
}

export function hasPortalPermission(
  role: PortalRole | null | undefined,
  permission: string
): boolean {
  if (!role) return false
  const list = PERMISSIONS_BY_ROLE[role]
  return list ? list.includes(permission) : false
}
