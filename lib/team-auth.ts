import 'server-only'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { hasPortalPermission, type PortalRole } from '@/lib/portal-permissions'

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserType = 'owner' | 'team_member'
export type TeamRole = PortalRole

export interface TeamMember {
  id: string
  client_id: string
  user_id: string
  name: string
  email: string
  /** Always `manager` or `agent` in the database; owners live on `clients`, not here. */
  role: 'manager' | 'agent'
  is_active: boolean
  created_at: string
  avatar_color?: string | null
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if the given role includes the requested permission.
 * Safe to call from any context — no I/O.
 */
export function hasPermission(role: TeamRole, permission: string): boolean {
  return hasPortalPermission(role, permission)
}

// ── Server helpers (require request context) ──────────────────────────────────

/**
 * Returns the portal_user_type cookie value, or null if not set.
 * Use this to branch render logic without an extra DB query.
 */
export async function getUserType(): Promise<UserType | null> {
  const store = await cookies()
  const value = store.get('portal_user_type')?.value
  if (value === 'owner' || value === 'team_member') return value
  return null
}

/**
 * Returns the portal_user_role cookie value (httpOnly), or null if not set.
 * For client components, use `readPortalUiRoleFromDocument` in `lib/portal-login.ts`
 * or receive `role` from a server parent.
 */
export async function getUserRole(): Promise<TeamRole | null> {
  const store = await cookies()
  const value = store.get('portal_user_role')?.value
  if (value === 'owner' || value === 'manager' || value === 'agent') return value
  return null
}

function normalizeMemberRole(raw: unknown): 'manager' | 'agent' {
  const r = String(raw ?? 'agent').toLowerCase()
  return r === 'manager' ? 'manager' : 'agent'
}

/**
 * Role for UI gating: prefers middleware cookies, otherwise resolves from Supabase
 * (covers the first request before cookies are visible to RSC in some setups).
 */
export async function getEffectivePortalRole(): Promise<TeamRole | null> {
  const fromCookie = await getUserRole()
  if (fromCookie) return fromCookie

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: ownerRow } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (ownerRow) return 'owner'

  const { data: memberRow } = await supabase
    .from('team_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (!memberRow) return null

  return normalizeMemberRole(memberRow.role)
}

/**
 * Returns true when the currently authenticated user is the account owner
 * (has a row in the `clients` table, not just `team_members`).
 * Reads from the middleware-set cookie — no extra DB query.
 */
export async function isOwner(): Promise<boolean> {
  return (await getUserType()) === 'owner'
}

/**
 * Returns the `team_members` row for the current session user, or null if:
 * - the user is not authenticated
 * - the user is the account owner (no team_members row)
 * - no matching active row found
 */
export async function getCurrentTeamMember(): Promise<TeamMember | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('team_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    ...data,
    role: normalizeMemberRole(data.role),
  } as TeamMember
}
