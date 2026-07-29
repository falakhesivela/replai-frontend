import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Client } from '@/lib/types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookie writes are no-ops
          }
        },
      },
    }
  )
}

/**
 * Access token for calling the backend API from Server Components / actions.
 * getSession() alone has proven unreliable in Server Components (see the note
 * in app/portal/(protected)/layout.tsx), so when it comes back empty we parse
 * the Supabase auth cookie (sb-<ref>-auth-token, possibly chunked and
 * base64-prefixed) directly.
 */
export async function getPortalAccessToken(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) return session.access_token

  const cookieStore = await cookies()
  const chunks = cookieStore
    .getAll()
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => {
      const na = Number(a.name.split('.').pop() ?? 0)
      const nb = Number(b.name.split('.').pop() ?? 0)
      return na - nb
    })
  if (chunks.length === 0) return null

  let raw = chunks.map((c) => c.value).join('')
  if (raw.startsWith('base64-')) {
    try {
      raw = Buffer.from(raw.slice(7), 'base64').toString('utf-8')
    } catch {
      return null
    }
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    const token = (parsed as { access_token?: unknown })?.access_token
    return typeof token === 'string' ? token : null
  } catch {
    return null
  }
}

/**
 * Returns the clients row for the currently authenticated user, or null if
 * the user is not signed in or has no associated client record.
 */
export async function getClientProfile(): Promise<Client | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: asOwner } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (asOwner) return asOwner

  const { data: membership } = await supabase
    .from('team_members')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!membership?.client_id) return null

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', membership.client_id)
    .maybeSingle()

  return client ?? null
}
