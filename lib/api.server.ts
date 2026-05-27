// Admin API client. THIS FILE IS SERVER-ONLY.
//
// It uses the unprefixed ADMIN_API_KEY env var, which must never be exposed
// to the browser. The `server-only` import causes the build to fail loudly if
// any client component (or anything reachable from a client component) tries
// to import from this module.
import 'server-only'

import type {
  AvailabilitySchedule,
  Booking,
  Client,
  ClientCreate,
  ClientCreateResponse,
  ClientSubscription,
  Conversation,
  KnowledgeFile,
  Plan,
  Service,
  SubscriptionDetail,
} from './types'

// Server-only: prefer the absolute INTERNAL_API_URL (bypasses the /api-proxy
// rewrite, which is browser-only and unusable for Node fetch).
const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL
const API_KEY = process.env.ADMIN_API_KEY

if (!API_URL) {
  throw new Error('INTERNAL_API_URL or NEXT_PUBLIC_API_URL must be set')
}
if (!API_KEY) {
  throw new Error(
    'ADMIN_API_KEY is not set. Define it (without the NEXT_PUBLIC_ prefix) in .env.local.'
  )
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'X-API-Key': API_KEY!,
      ...init.headers,
    },
    // Admin reads should always reflect the latest state of the backend.
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<T>
}

// ── Clients ──────────────────────────────────────────────────────────────────

export function getClients(): Promise<Client[]> {
  return adminFetch('/clients')
}

export function getClient(id: string): Promise<Client> {
  return adminFetch(`/clients/${id}`)
}

export function createClient(data: ClientCreate): Promise<ClientCreateResponse> {
  return adminFetch('/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updateSystemPrompt(id: string, prompt: string): Promise<Client> {
  return adminFetch(`/clients/${id}/prompt`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_prompt: prompt }),
  })
}

// ── Knowledge ────────────────────────────────────────────────────────────────

export function uploadKnowledge(id: string, file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  return adminFetch(`/clients/${id}/knowledge`, {
    method: 'POST',
    body: form,
  })
}

export function deleteKnowledge(id: string): Promise<void> {
  return adminFetch(`/clients/${id}/knowledge`, { method: 'DELETE' })
}

export function getKnowledgeFiles(id: string): Promise<KnowledgeFile[]> {
  return adminFetch(`/clients/${id}/knowledge`)
}

// ── Conversations (admin view) ───────────────────────────────────────────────

export function getClientConversations(id: string): Promise<Conversation[]> {
  return adminFetch(`/clients/${id}/conversations`)
}

// ── AI cost telemetry (admin only) ───────────────────────────────────────────

export function getClientUsage(
  id: string,
  days = 30
): Promise<import('./types').ClientUsage> {
  return adminFetch(`/clients/${id}/usage?days=${days}`)
}

// ── Services & availability ──────────────────────────────────────────────────

export function createClientService(
  clientId: string,
  data: { name: string; duration_minutes: number; description?: string | null }
): Promise<Service> {
  return adminFetch(`/clients/${clientId}/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteClientService(clientId: string, serviceId: string): Promise<void> {
  return adminFetch(`/clients/${clientId}/services/${serviceId}`, { method: 'DELETE' })
}

export function setClientAvailability(
  clientId: string,
  schedules: Pick<AvailabilitySchedule, 'day_of_week' | 'start_time' | 'end_time'>[]
): Promise<AvailabilitySchedule[]> {
  return adminFetch(`/clients/${clientId}/availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules }),
  })
}

export function updateClientBookingStatus(
  clientId: string,
  bookingId: string,
  status: Booking['status']
): Promise<Booking> {
  return adminFetch(`/clients/${clientId}/bookings/${bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

// ── Subscription (admin) ──────────────────────────────────────────────────────

export function getClientSubscriptionDetail(clientId: string): Promise<SubscriptionDetail> {
  return adminFetch(`/clients/${clientId}/subscription`)
}

export function toggleClientFeatureAdmin(
  clientId: string,
  plan_key: string,
  enabled: boolean
): Promise<{ subscription: ClientSubscription; features: Record<string, boolean> }> {
  return adminFetch(`/clients/${clientId}/subscription/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan_key, enabled }),
  })
}

// ── Trial config (god-view) ──────────────────────────────────────────────────

export interface TrialConfig {
  duration_days: number
  channels: string[]
  addons: string[]
  included_conversations: number | null
  is_active: boolean
}

export function getTrialConfig(): Promise<TrialConfig> {
  return adminFetch('/admin/trial-config')
}

export function updateTrialConfig(body: Partial<TrialConfig>): Promise<TrialConfig> {
  return adminFetch('/admin/trial-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
