import type { SupabaseClient } from '@supabase/supabase-js'

export type PortalLandingRole = 'owner' | 'manager' | 'agent'

/**
 * Reads `portal_ui_role` (non-httpOnly) in the browser for lightweight UI checks.
 * Server code should prefer `getUserRole` / `getEffectivePortalRole` in `lib/team-auth.ts`.
 */
export function readPortalUiRoleFromDocument(): PortalLandingRole | null {
  if (typeof document === 'undefined') return null
  const row = document.cookie.split('; ').find((c) => c.startsWith('portal_ui_role='))
  const raw = row?.split('=')[1]
  if (raw === 'owner' || raw === 'manager' || raw === 'agent') return raw
  return null
}

/** Default landing path after a successful portal sign-in. */
export function portalPathForRole(role: PortalLandingRole): string {
  if (role === 'agent') return '/portal/conversations'
  return '/portal/overview'
}

/**
 * Resolves where to send the user after password login (owners vs team).
 * Uses the same access rules as middleware: `clients.user_id` or active `team_members`.
 */
export async function resolvePortalLanding(
  supabase: SupabaseClient,
  userId: string
): Promise<{ path: string; role: PortalLandingRole } | { error: 'no_account' }> {
  const { data: clientRow } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (clientRow) {
    return { path: portalPathForRole('owner'), role: 'owner' }
  }

  const { data: memberRow } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!memberRow) {
    return { error: 'no_account' }
  }

  const raw = String(memberRow.role ?? 'agent').toLowerCase()
  const role: PortalLandingRole = raw === 'manager' ? 'manager' : 'agent'
  return { path: portalPathForRole(role), role }
}
