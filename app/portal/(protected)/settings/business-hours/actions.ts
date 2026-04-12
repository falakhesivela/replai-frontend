'use server'

import { createClient } from '@/lib/supabase/server'

export type TimezoneState = {
  success?: boolean
  error?: string
}

export async function saveTimezoneAction(
  _prev: TimezoneState,
  formData: FormData
): Promise<TimezoneState> {
  const timezone = (formData.get('timezone') as string | null)?.trim()
  if (!timezone) return { error: 'Timezone is required.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('clients')
    .update({ timezone })
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}
