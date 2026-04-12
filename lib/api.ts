// Portal API client. Safe to import from client components — it only sends
// the caller's own Supabase JWT and never the admin API key.
//
// Admin endpoints live in lib/api.server.ts and are server-only.
import type {
  ActivityLogEntry,
  AfterHoursMessage,
  AvailabilitySchedule,
  Booking,
  Broadcast,
  BroadcastAudience,
  BroadcastAudiencePreview,
  BroadcastDetail,
  BusinessHoursItem,
  Client,
  ClosedDate,
  Conversation,
  ConversationNote,
  KnowledgeFile,
  Message,
  PortalCollaborationContext,
  PortalNotification,
  PortalTeamDirectory,
  PortalTeamInviteResult,
  Service,
  Slot,
} from './types'

// On the server (server actions, route handlers) use INTERNAL_API_URL which
// points directly at the backend — Next.js rewrite rules don't apply to
// server-side fetch, so /api-proxy/* would fail to resolve.
const API_URL =
  typeof window === 'undefined'
    ? (process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL)
    : process.env.NEXT_PUBLIC_API_URL

/**
 * Thrown when the backend rejects the caller's Supabase JWT (401/403).
 * Callers can catch this to redirect the user to the login page instead of
 * surfacing a generic "API error 401" message.
 */
export class PortalAuthError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'PortalAuthError'
    this.status = status
  }
}

/**
 * A function that returns a fresh Supabase access token. Pass a getter rather
 * than a raw token so portalFetch can request a fresh JWT each call — Supabase
 * tokens are short-lived and a token captured at page mount may already be
 * expired by the time the user clicks something.
 */
export type TokenGetter = () => Promise<string | null> | string | null

async function portalFetch<T>(
  path: string,
  tokenOrGetter: string | TokenGetter,
  init: RequestInit = {}
): Promise<T> {
  const token =
    typeof tokenOrGetter === 'function' ? await tokenOrGetter() : tokenOrGetter

  if (!token) {
    throw new PortalAuthError(401, 'Not authenticated')
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })

  if (res.status === 401 || res.status === 403) {
    throw new PortalAuthError(res.status, await res.text())
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<T>
}

// ── Profile ──────────────────────────────────────────────────────────────────

export function getMyClient(token: string | TokenGetter): Promise<Client> {
  return portalFetch('/portal/me', token)
}

// ── System prompt ────────────────────────────────────────────────────────────

export function updateMySystemPrompt(
  token: string | TokenGetter,
  prompt: string
): Promise<Client> {
  return portalFetch('/portal/me/prompt', token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_prompt: prompt }),
  })
}

// ── Agent settings ───────────────────────────────────────────────────────────

export function updateMyAgentSettings(
  token: string | TokenGetter,
  settings: {
    agent_name?: string
    agent_auto_language?: boolean
    agent_use_emoji?: boolean
    agent_sign_off?: boolean
    agent_response_style?: 'formal' | 'friendly' | 'casual'
  }
): Promise<Client> {
  return portalFetch('/portal/me/agent', token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
}

// ── Knowledge base ───────────────────────────────────────────────────────────

export function uploadMyKnowledge(
  token: string | TokenGetter,
  file: File
): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  return portalFetch('/portal/me/knowledge', token, {
    method: 'POST',
    body: form,
  })
}

export function deleteMyKnowledge(token: string | TokenGetter): Promise<void> {
  return portalFetch('/portal/me/knowledge', token, { method: 'DELETE' })
}

export function deleteMyKnowledgeFile(
  token: string | TokenGetter,
  filename: string
): Promise<void> {
  return portalFetch(`/portal/me/knowledge/${encodeURIComponent(filename)}`, token, {
    method: 'DELETE',
  })
}

export function getMyKnowledgeFiles(
  token: string | TokenGetter
): Promise<KnowledgeFile[]> {
  return portalFetch('/portal/me/knowledge', token)
}

// ── Conversations ────────────────────────────────────────────────────────────

export function getMyConversations(
  token: string | TokenGetter,
  params?: { status?: string; assigned_to?: 'me' | 'unassigned' }
): Promise<Conversation[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.assigned_to) qs.set('assigned_to', params.assigned_to)
  const q = qs.toString()
  return portalFetch(`/portal/me/conversations${q ? `?${q}` : ''}`, token)
}

export function assignPortalConversation(
  token: string | TokenGetter,
  customerPhone: string,
  memberId: string | null
): Promise<Conversation> {
  return portalFetch(
    `/portal/me/conversations/${encodeURIComponent(customerPhone)}/assign`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    }
  )
}

export function getPortalConversationNotes(
  token: string | TokenGetter,
  customerPhone: string
): Promise<ConversationNote[]> {
  return portalFetch(
    `/portal/me/conversations/${encodeURIComponent(customerPhone)}/notes`,
    token
  )
}

export function createPortalConversationNote(
  token: string | TokenGetter,
  customerPhone: string,
  content: string
): Promise<ConversationNote> {
  return portalFetch(
    `/portal/me/conversations/${encodeURIComponent(customerPhone)}/notes`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }
  )
}

export function deletePortalConversationNote(
  token: string | TokenGetter,
  customerPhone: string,
  noteId: string
): Promise<{ status: string }> {
  return portalFetch(
    `/portal/me/conversations/${encodeURIComponent(customerPhone)}/notes/${encodeURIComponent(noteId)}`,
    token,
    { method: 'DELETE' }
  )
}

export function getPortalCollaborationContext(
  token: string | TokenGetter
): Promise<PortalCollaborationContext> {
  return portalFetch('/portal/me/collaboration/context', token)
}

export function getPortalNotifications(
  token: string | TokenGetter
): Promise<PortalNotification[]> {
  return portalFetch('/portal/me/notifications', token)
}

export function markPortalNotificationsRead(
  token: string | TokenGetter,
  notificationId?: string | null
): Promise<{ status: string }> {
  return portalFetch('/portal/me/notifications/read', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification_id: notificationId ?? null }),
  })
}

export function getMyMessages(
  token: string | TokenGetter,
  customerPhone: string
): Promise<Message[]> {
  return portalFetch(
    `/portal/me/conversations/${encodeURIComponent(customerPhone)}/messages`,
    token
  )
}

export function sendReply(
  token: string | TokenGetter,
  customerPhone: string,
  message: string
): Promise<{ status: string }> {
  return portalFetch(
    `/portal/me/conversations/${encodeURIComponent(customerPhone)}/reply`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }
  )
}

export function updateConversationStatus(
  token: string | TokenGetter,
  customerPhone: string,
  status: 'ai' | 'human' | 'resolved'
): Promise<{ status: string }> {
  return portalFetch(
    `/portal/me/conversations/${encodeURIComponent(customerPhone)}/status`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }
  )
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export function getMyBookings(
  token: string | TokenGetter,
  params?: { status?: string; date?: string }
): Promise<Booking[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.date) qs.set('date', params.date)
  const query = qs.toString()
  return portalFetch(`/portal/me/bookings${query ? `?${query}` : ''}`, token)
}

export function getMyBookingsToday(
  token: string | TokenGetter
): Promise<Booking[]> {
  return portalFetch('/portal/me/bookings/today', token)
}

export function updateMyBookingStatus(
  token: string | TokenGetter,
  bookingId: string,
  status: Booking['status']
): Promise<Booking> {
  return portalFetch(`/portal/me/bookings/${bookingId}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

export function getMyAvailableSlots(
  token: string | TokenGetter,
  serviceId: string,
  daysAhead = 14
): Promise<Slot[]> {
  return portalFetch(
    `/portal/me/bookings/slots?service_id=${encodeURIComponent(serviceId)}&days_ahead=${daysAhead}`,
    token
  )
}

export function createMyBooking(
  token: string | TokenGetter,
  data: { customer_phone: string; customer_name: string; service_id: string; slot_id: string }
): Promise<Booking> {
  return portalFetch('/portal/me/bookings', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// ── Team (portal — owners + managers) ───────────────────────────────────────

export function getPortalTeamDirectory(
  token: string | TokenGetter
): Promise<PortalTeamDirectory> {
  return portalFetch('/portal/me/team/members', token)
}

export function invitePortalTeamMember(
  token: string | TokenGetter,
  body: { name: string; email: string; role: 'manager' | 'agent' }
): Promise<PortalTeamInviteResult> {
  return portalFetch('/portal/me/team/members/invite', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function patchPortalTeamMember(
  token: string | TokenGetter,
  memberId: string,
  body: { name?: string; role?: 'manager' | 'agent'; is_active?: boolean }
): Promise<Record<string, unknown>> {
  return portalFetch(`/portal/me/team/members/${encodeURIComponent(memberId)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function removePortalTeamMember(
  token: string | TokenGetter,
  memberId: string
): Promise<{ status: string }> {
  return portalFetch(`/portal/me/team/members/${encodeURIComponent(memberId)}`, token, {
    method: 'DELETE',
  })
}

// ── Services & availability (portal-scoped) ─────────────────────────────────

export function getMyServices(token: string | TokenGetter): Promise<Service[]> {
  return portalFetch('/portal/me/services', token)
}

export function createMyService(
  token: string | TokenGetter,
  data: { name: string; duration_minutes: number; description?: string | null }
): Promise<Service> {
  return portalFetch('/portal/me/services', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteMyService(
  token: string | TokenGetter,
  serviceId: string
): Promise<void> {
  return portalFetch(`/portal/me/services/${serviceId}`, token, {
    method: 'DELETE',
  })
}

export function getMyAvailability(
  token: string | TokenGetter
): Promise<AvailabilitySchedule[]> {
  return portalFetch('/portal/me/availability', token)
}

export function setMyAvailability(
  token: string | TokenGetter,
  schedules: Pick<AvailabilitySchedule, 'day_of_week' | 'start_time' | 'end_time'>[]
): Promise<AvailabilitySchedule[]> {
  return portalFetch('/portal/me/availability', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules }),
  })
}

// ── Broadcasts ────────────────────────────────────────────────────────────────

export function getMyBroadcasts(token: string | TokenGetter): Promise<Broadcast[]> {
  return portalFetch('/portal/me/broadcasts', token)
}

export function createMyBroadcast(
  token: string | TokenGetter,
  data: {
    name: string
    message: string
    target_audience: BroadcastAudience
    scheduled_at: string | null
  }
): Promise<Broadcast> {
  return portalFetch('/portal/me/broadcasts', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function sendMyBroadcast(
  token: string | TokenGetter,
  broadcastId: string
): Promise<{ status: string }> {
  return portalFetch(`/portal/me/broadcasts/${encodeURIComponent(broadcastId)}/send`, token, {
    method: 'POST',
  })
}

export function cancelMyBroadcast(
  token: string | TokenGetter,
  broadcastId: string
): Promise<Broadcast> {
  return portalFetch(`/portal/me/broadcasts/${encodeURIComponent(broadcastId)}/cancel`, token, {
    method: 'POST',
  })
}

export async function deleteMyBroadcast(
  tokenOrGetter: string | TokenGetter,
  broadcastId: string
): Promise<void> {
  const token =
    typeof tokenOrGetter === 'function' ? await tokenOrGetter() : tokenOrGetter
  if (!token) throw new PortalAuthError(401, 'Not authenticated')
  const res = await fetch(
    `${API_URL}/portal/me/broadcasts/${encodeURIComponent(broadcastId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.status === 401 || res.status === 403)
    throw new PortalAuthError(res.status, await res.text())
  if (!res.ok && res.status !== 204)
    throw new Error(`API error ${res.status}: ${await res.text()}`)
}

export function getMyBroadcast(
  token: string | TokenGetter,
  broadcastId: string
): Promise<BroadcastDetail> {
  return portalFetch(`/portal/me/broadcasts/${encodeURIComponent(broadcastId)}`, token)
}

export interface BroadcastValidationResult {
  valid: boolean
  warnings: string[]
  char_count: number
  variables_found: string[]
  supported_variables: Record<string, string>
}

export function validateBroadcastMessage(
  token: string | TokenGetter,
  message: string
): Promise<BroadcastValidationResult> {
  return portalFetch('/portal/me/broadcasts/validate', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}

export function getMyBroadcastAudiencePreview(
  token: string | TokenGetter,
  targetAudience: BroadcastAudience
): Promise<BroadcastAudiencePreview> {
  return portalFetch(
    `/portal/me/broadcasts/audience?target_audience=${encodeURIComponent(targetAudience)}`,
    token
  )
}

// ── Activity log ─────────────────────────────────────────────────────────────

export function getActivityLog(
  token: string | TokenGetter,
  params?: { member_id?: string; page?: number; limit?: number }
): Promise<ActivityLogEntry[]> {
  const qs = new URLSearchParams()
  if (params?.member_id) qs.set('member_id', params.member_id)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  const q = qs.toString()
  return portalFetch(`/portal/me/activity${q ? `?${q}` : ''}`, token)
}

// ── Temporary closure ─────────────────────────────────────────────────────────

export function setTempClosure(
  token: string | TokenGetter,
  temp_closed: boolean,
  temp_closed_message?: string | null
): Promise<Client> {
  return portalFetch('/portal/me/temp-closure', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ temp_closed, temp_closed_message: temp_closed_message ?? null }),
  })
}

// ── Business hours ────────────────────────────────────────────────────────────

export function getMyBusinessHours(
  token: string | TokenGetter
): Promise<BusinessHoursItem[]> {
  return portalFetch('/portal/me/business-hours', token)
}

export function setMyBusinessHours(
  token: string | TokenGetter,
  schedules: Pick<BusinessHoursItem, 'day_of_week' | 'is_open' | 'open_time' | 'close_time'>[]
): Promise<BusinessHoursItem[]> {
  return portalFetch('/portal/me/business-hours', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schedules }),
  })
}

// ── Closed dates ──────────────────────────────────────────────────────────────

export function getMyClosedDates(
  token: string | TokenGetter
): Promise<ClosedDate[]> {
  return portalFetch('/portal/me/closed-dates', token)
}

export function addMyClosedDate(
  token: string | TokenGetter,
  date: string,
  reason?: string | null
): Promise<ClosedDate> {
  return portalFetch('/portal/me/closed-dates', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, reason: reason ?? null }),
  })
}

// DELETE returns 204 (no body) — bypass portalFetch's json() call.
export async function deleteMyClosedDate(
  tokenOrGetter: string | TokenGetter,
  date: string
): Promise<void> {
  const token =
    typeof tokenOrGetter === 'function' ? await tokenOrGetter() : tokenOrGetter
  if (!token) throw new PortalAuthError(401, 'Not authenticated')

  const res = await fetch(
    `${API_URL}/portal/me/closed-dates/${encodeURIComponent(date)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
  if (res.status === 401 || res.status === 403)
    throw new PortalAuthError(res.status, await res.text())
  if (!res.ok && res.status !== 204)
    throw new Error(`API error ${res.status}: ${await res.text()}`)
}

// ── After-hours messages ──────────────────────────────────────────────────────

export function getAfterHoursMessages(
  token: string | TokenGetter
): Promise<AfterHoursMessage[]> {
  return portalFetch('/portal/me/after-hours-messages', token)
}

export function markAfterHoursMessageRead(
  token: string | TokenGetter,
  id: string
): Promise<AfterHoursMessage> {
  return portalFetch(`/portal/me/after-hours-messages/${encodeURIComponent(id)}/read`, token, {
    method: 'POST',
  })
}

// Re-export types so callers can import from one place
export type {
  ActivityLogEntry,
  Broadcast,
  BroadcastAudience,
  BroadcastAudiencePreview,
  BroadcastDetail,
  BroadcastRecipient,
  BroadcastStatus,
  AfterHoursMessage,
  AvailabilitySchedule,
  Booking,
  BusinessHoursItem,
  Client,
  ClientCreate,
  ClientCreateResponse,
  ClosedDate,
  Conversation,
  ConversationNote,
  KnowledgeFile,
  Message,
  PortalCollaborationContext,
  PortalNotification,
  PortalTeamDirectory,
  PortalTeamInviteResult,
  PortalTeamRow,
  Service,
  Slot,
} from './types'
