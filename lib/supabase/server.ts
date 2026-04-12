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
