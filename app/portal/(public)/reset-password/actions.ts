'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ResetPasswordState = {
  fieldError?: string
  error?: string
}

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = (formData.get('password') as string).trim()
  const confirm = (formData.get('confirm') as string).trim()

  if (!password) return { fieldError: 'Password is required.' }
  if (password.length < 8) return { fieldError: 'Password must be at least 8 characters.' }
  if (password !== confirm) return { fieldError: 'Passwords do not match.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) return { error: error.message }

  redirect('/portal/login?reset=1')
}
