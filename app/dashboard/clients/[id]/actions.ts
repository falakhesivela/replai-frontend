'use server'

import { revalidatePath } from 'next/cache'

import {
  deleteKnowledge,
  getKnowledgeFiles,
  toggleClientFeatureAdmin,
  updateSystemPrompt,
  uploadKnowledge,
} from '@/lib/api.server'
import type { ClientSubscription, KnowledgeFile } from '@/lib/types'

export type SystemPromptState = {
  success?: boolean
  error?: string
}

export async function saveSystemPromptAction(
  _prevState: SystemPromptState,
  formData: FormData
): Promise<SystemPromptState> {
  const id = formData.get('id') as string
  const prompt = (formData.get('system_prompt') as string).trim()

  if (!prompt) return { error: 'System prompt cannot be empty.' }

  try {
    await updateSystemPrompt(id, prompt)
    revalidatePath(`/dashboard/clients/${id}`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save changes.' }
  }
}

// ── Knowledge actions (called from the KnowledgeCard client component) ──────
// These exist so the client component never imports lib/api.server.ts directly
// and the admin API key stays out of the browser bundle.

export async function uploadKnowledgeAction(
  clientId: string,
  formData: FormData
): Promise<{ files: KnowledgeFile[]; error?: string }> {
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { files: [], error: 'No file provided.' }
  }
  try {
    await uploadKnowledge(clientId, file)
    const files = await getKnowledgeFiles(clientId)
    revalidatePath(`/dashboard/clients/${clientId}`)
    return { files }
  } catch (err) {
    return {
      files: [],
      error: err instanceof Error ? err.message : 'Upload failed.',
    }
  }
}

export async function clearKnowledgeAction(
  clientId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await deleteKnowledge(clientId)
    revalidatePath(`/dashboard/clients/${clientId}`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to clear files.',
    }
  }
}

// ── Subscription actions ──────────────────────────────────────────────────────

export async function toggleClientFeatureAction(
  clientId: string,
  planKey: string,
  enabled: boolean
): Promise<{ subscription: ClientSubscription; features: Record<string, boolean>; error?: string }> {
  try {
    const result = await toggleClientFeatureAdmin(clientId, planKey, enabled)
    revalidatePath(`/dashboard/clients/${clientId}`)
    return result
  } catch (err) {
    return {
      subscription: {} as ClientSubscription,
      features: {},
      error: err instanceof Error ? err.message : 'Failed to update feature.',
    }
  }
}
