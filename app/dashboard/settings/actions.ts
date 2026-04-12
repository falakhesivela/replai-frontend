'use server'

import { createClient } from '@/lib/supabase/server'

export type PasswordState = {
  success?: boolean
  error?: string
  fieldError?: string
}

export async function changePasswordAction(
  _prevState: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const password = (formData.get('password') as string).trim()
  const confirm = (formData.get('confirm') as string).trim()

  if (!password) return { fieldError: 'New password is required.' }
  if (password.length < 8) return { fieldError: 'Password must be at least 8 characters.' }
  if (password !== confirm) return { fieldError: 'Passwords do not match.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }
  return { success: true }
}
