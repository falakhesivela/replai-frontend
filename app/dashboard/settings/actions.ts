'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateTrialConfig } from '@/lib/api.server'

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

export type TrialConfigState = {
  success?: boolean
  error?: string
}

export async function saveTrialConfigAction(
  _prevState: TrialConfigState,
  formData: FormData
): Promise<TrialConfigState> {
  const duration = parseInt(String(formData.get('duration_days') ?? ''), 10)
  if (!Number.isFinite(duration) || duration < 1) {
    return { error: 'Trial length must be at least 1 day.' }
  }

  const includedRaw = String(formData.get('included_conversations') ?? '').trim()
  const included = includedRaw === '' ? null : parseInt(includedRaw, 10)
  if (included !== null && (!Number.isFinite(included) || included < 0)) {
    return { error: 'Included conversations must be a non-negative number (or blank for unlimited).' }
  }

  try {
    await updateTrialConfig({
      duration_days: duration,
      channels: formData.getAll('channels').map(String),
      addons: formData.getAll('addons').map(String),
      included_conversations: included,
      is_active: formData.get('is_active') === 'on',
    })
    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save trial settings.' }
  }
}
