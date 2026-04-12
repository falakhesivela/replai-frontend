'use server'

import { createClient } from '@/lib/supabase/server'
import { isOwner } from '@/lib/team-auth'

export type PasswordState = {
  success?: boolean
  error?: string
  fieldError?: string
}

export type CredentialsState = {
  success?: boolean
  error?: string
}

export async function changePasswordAction(
  _prevState: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const current = (formData.get('current_password') as string).trim()
  const next = (formData.get('password') as string).trim()
  const confirm = (formData.get('confirm') as string).trim()

  if (!current) return { fieldError: 'Current password is required.' }
  if (!next) return { fieldError: 'New password is required.' }
  if (next.length < 8) return { fieldError: 'New password must be at least 8 characters.' }
  if (next !== confirm) return { fieldError: 'Passwords do not match.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) return { error: 'Not authenticated.' }

  // Re-authenticate with the current password before allowing the change
  const { error: reAuthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  })
  if (reAuthError) return { fieldError: 'Current password is incorrect.' }

  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) return { error: error.message }

  return { success: true }
}

export async function updateCredentialsAction(
  _prevState: CredentialsState,
  formData: FormData
): Promise<CredentialsState> {
  if (!(await isOwner())) {
    return { error: 'Only the account owner can update WhatsApp credentials.' }
  }

  const phoneNumberId = (formData.get('wa_phone_number_id') as string).trim()
  const accessToken = (formData.get('wa_access_token') as string).trim()

  if (!phoneNumberId) return { error: 'Phone Number ID is required.' }
  if (!accessToken) return { error: 'Access token is required.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('clients')
    .update({ wa_phone_number_id: phoneNumberId, wa_access_token: accessToken })
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  return { success: true }
}
