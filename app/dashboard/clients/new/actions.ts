'use server'

import { createClient } from '@/lib/api.server'

export type CreateClientState = {
  errors?: {
    business_name?: string
    client_email?: string
    wa_phone_number?: string
    wa_phone_number_id?: string
    wa_access_token?: string
    system_prompt?: string
    _form?: string
  }
  success?: {
    clientId: string
    temporaryPassword: string
  }
}

export async function createClientAction(
  _prevState: CreateClientState,
  formData: FormData
): Promise<CreateClientState> {
  const business_name = (formData.get('business_name') as string).trim()
  const client_email = (formData.get('client_email') as string).trim()
  const wa_phone_number = (formData.get('wa_phone_number') as string).trim()
  const wa_phone_number_id = (formData.get('wa_phone_number_id') as string).trim()
  const wa_access_token = (formData.get('wa_access_token') as string).trim()
  const system_prompt = (formData.get('system_prompt') as string).trim()

  const errors: CreateClientState['errors'] = {}

  if (!business_name) errors.business_name = 'Business name is required.'
  if (!client_email) errors.client_email = 'Client email is required.'
  if (!wa_phone_number) errors.wa_phone_number = 'WhatsApp phone number is required.'
  if (!wa_phone_number_id) errors.wa_phone_number_id = 'Phone Number ID is required.'
  if (!wa_access_token) errors.wa_access_token = 'Access token is required.'
  if (!system_prompt) errors.system_prompt = 'System prompt is required.'

  if (Object.keys(errors).length > 0) return { errors }

  try {
    const result = await createClient({
      business_name,
      email: client_email,
      wa_phone_number,
      wa_phone_number_id,
      wa_access_token,
      system_prompt,
    })
    return {
      success: {
        clientId: result.id,
        temporaryPassword: result.temporary_password,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
    return { errors: { _form: message } }
  }
}
