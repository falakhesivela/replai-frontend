// Mirrors the FastAPI Pydantic models on the backend.

export interface Client {
  id: string
  business_name: string
  wa_phone_number_id: string
  wa_access_token: string
  wa_phone_number: string
  system_prompt: string
  is_active: boolean
  user_id?: string
  timezone?: string
  temp_closed?: boolean
  temp_closed_message?: string | null
  agent_name?: string
  agent_auto_language?: boolean
  agent_use_emoji?: boolean
  agent_sign_off?: boolean
  agent_response_style?: 'formal' | 'friendly' | 'casual'
}

export interface BusinessHoursItem {
  id?: string
  client_id?: string
  day_of_week: number   // 0=Monday … 6=Sunday
  is_open: boolean
  open_time: string | null   // "HH:MM"
  close_time: string | null  // "HH:MM"
}

export interface ClosedDate {
  id: string
  client_id?: string
  date: string          // "YYYY-MM-DD"
  reason: string | null
  created_at?: string
}

export interface AfterHoursMessage {
  id: string
  client_id?: string
  customer_phone: string
  message: string
  is_read: boolean
  created_at: string
}

export interface ClientCreate {
  business_name: string
  wa_phone_number_id: string
  wa_access_token: string
  wa_phone_number: string
  system_prompt: string
  email: string
}

export interface ClientCreateResponse extends Client {
  temporary_password: string
}

export interface KnowledgeFile {
  filename: string
  size?: number
  chunks?: number
  created_at?: string
}

/** Assignee embedded from PostgREST when listing conversations with a join. */
export interface ConversationAssignee {
  id: string
  name: string
  avatar_color?: string | null
}

export interface Conversation {
  id: string
  client_id: string
  customer_phone: string
  status: 'ai' | 'human' | 'resolved'
  last_message?: string
  last_message_at?: string
  unread_count: number
  message_count?: number
  summary?: string | null
  last_sentiment_score?: number | null
  last_sentiment_label?: string | null
  detected_language?: string | null
  created_at: string
  updated_at: string
  assigned_to?: string | null
  assigned_at?: string | null
  /** FK embed from API — object or array depending on PostgREST shape */
  team_members?: ConversationAssignee | ConversationAssignee[] | null
}

export interface ConversationNote {
  id: string
  client_id: string
  customer_phone: string
  author_id: string | null
  author_name: string
  content: string
  mentions?: string[]
  created_at: string
  can_delete: boolean
  team_members?: { name: string; avatar_color?: string | null } | null
}

export interface PortalNotification {
  id: string
  client_id: string
  team_member_id: string
  type: string
  title: string
  body: string
  is_read: boolean
  conversation_phone?: string | null
  created_at: string
}

export interface PortalCollaborationMember {
  id: string
  name: string
  avatar_color?: string | null
  role: string
}

export interface PortalCollaborationContext {
  viewer_member_id: string | null
  members: PortalCollaborationMember[]
}

export interface Message {
  id: string
  client_id: string
  customer_phone: string
  role: 'user' | 'assistant' | 'human_agent' | 'system'
  content: string
  message_type?: 'text' | 'voice' | 'image'
  created_at: string
}

export interface Service {
  id: string
  client_id: string
  name: string
  duration_minutes: number
  description: string | null
  is_active: boolean
  created_at: string
}

export interface AvailabilitySchedule {
  id?: string
  client_id?: string
  day_of_week: number  // 0=Monday … 6=Sunday
  start_time: string   // "HH:MM" or "HH:MM:SS"
  end_time: string
}

export interface Slot {
  date: string        // "YYYY-MM-DD"
  date_label: string  // "Monday 7 Apr"
  time: string        // "HH:MM"
  time_label: string  // "9:00 AM"
  slot_id: string     // "YYYY-MM-DD-HH:MM"
}

export interface Booking {
  id: string
  client_id: string
  customer_phone: string
  customer_name: string
  service_id: string
  booking_date: string  // "YYYY-MM-DD"
  booking_time: string  // "HH:MM"
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  created_at: string
  services: { name: string; duration_minutes: number } | null
}

export interface PortalTeamRowActions {
  change_role: boolean
  deactivate: boolean
  remove: boolean
}

export interface PortalTeamRow {
  member_id: string | null
  user_id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'agent'
  is_active: boolean
  conversation_count: number
  avatar_color: string | null
  is_self: boolean
  actions: PortalTeamRowActions
}

export interface PortalTeamDirectory {
  can_invite: boolean
  viewer_user_id: string
  viewer_member_id: string | null
  rows: PortalTeamRow[]
}

export interface ActivityLogEntry {
  id: string
  client_id: string
  member_id: string | null
  member_name: string
  action: string
  details: string | null
  conversation_phone: string | null
  created_at: string
}

export type BroadcastAudience = 'all' | 'leads' | 'bookings' | 'active_conversations'
export type BroadcastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'

export interface Broadcast {
  id: string
  client_id: string
  name: string
  message: string
  target_audience: BroadcastAudience
  status: BroadcastStatus
  total_recipients: number
  sent_count: number
  failed_count: number
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
  recipient_count?: number  // returned only on create
}

export interface BroadcastRecipient {
  phone: string
  name: string | null
  status: 'pending' | 'sent' | 'failed'
}

export interface BroadcastDetail extends Broadcast {
  recipients: BroadcastRecipient[]
  stats: {
    total: number
    sent: number
    failed: number
    pending: number
    delivery_rate: number
  }
}

export interface BroadcastAudiencePreview {
  count: number
  sample: string[]
}

export interface PortalTeamInviteResult {
  id: string
  client_id: string
  user_id: string
  name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  temp_password: string
  /** False when Resend failed or was skipped (invite still created; share password manually). */
  email_sent?: boolean
}
