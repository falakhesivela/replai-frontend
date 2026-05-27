'use server'

import { createClient } from '@/lib/supabase/server'
import { updateMySystemPrompt, updateMyAgentSettings, toggleMyAI } from '@/lib/api'
import { getEffectivePortalRole, hasPermission } from '@/lib/team-auth'

export type ActionState = {
  success?: boolean
  error?: string
}

export async function saveSystemPromptAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role = await getEffectivePortalRole()
  if (!role || !hasPermission(role, 'manage_agent')) {
    return { error: 'You do not have permission to edit the agent configuration.' }
  }

  const prompt = (formData.get('system_prompt') as string).trim()

  if (!prompt) return { error: 'System prompt cannot be empty.' }

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return { error: 'Not authenticated.' }

  try {
    await updateMySystemPrompt(session.access_token, prompt)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save changes.' }
  }
}

export async function saveAgentNameAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role = await getEffectivePortalRole()
  if (!role || !hasPermission(role, 'manage_agent')) {
    return { error: 'You do not have permission to edit the agent configuration.' }
  }

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return { error: 'Not authenticated.' }

  const agentName = (formData.get('agent_name') as string ?? '').trim()

  try {
    await updateMyAgentSettings(session.access_token, { agent_name: agentName })
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save changes.' }
  }
}

export async function saveAgentSettingsAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role = await getEffectivePortalRole()
  if (!role || !hasPermission(role, 'manage_agent')) {
    return { error: 'You do not have permission to edit the agent configuration.' }
  }

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return { error: 'Not authenticated.' }

  const style = formData.get('response_style') as 'formal' | 'friendly' | 'casual'

  try {
    await updateMyAgentSettings(session.access_token, {
      agent_auto_language: formData.get('auto_language') === 'true',
      agent_use_emoji: formData.get('use_emoji') === 'true',
      agent_sign_off: formData.get('sign_off') === 'true',
      agent_response_style: style,
    })
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save changes.' }
  }
}

export async function toggleAIAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role = await getEffectivePortalRole()
  if (!role || !hasPermission(role, 'manage_agent')) {
    return { error: 'You do not have permission to change AI settings.' }
  }

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Not authenticated.' }

  const enabled = formData.get('ai_enabled') === 'true'
  try {
    await toggleMyAI(session.access_token, enabled)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save changes.' }
  }
}
