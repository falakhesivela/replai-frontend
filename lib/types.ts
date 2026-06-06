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
  reminder_enabled?: boolean
  reminder_hours_before?: number
  ai_enabled?: boolean
  notify_new_conversation_email?: boolean
  notify_escalation_email?: boolean
}

export interface BookingIntakeField {
  key: string
  type: 'integer' | 'text'
  label: string
  required: boolean
  min?: number | null
  max?: number | null
}

export type SchedulingMode = 'slot' | 'date_only' | 'date_range'

export interface BookingSettings {
  days_ahead: number
  min_notice_minutes: number
  min_notice: string
  same_day_allowed: boolean
  send_confirmation: boolean
  ask_guest_count: boolean
  intake_fields: BookingIntakeField[]
  scheduling_mode: SchedulingMode
  daily_capacity: number
  max_guests_per_day: number | null
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
  channel?: 'whatsapp' | 'web'
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
  department_id?: string | null
  /** FK embed from API — object or array depending on PostgREST shape */
  team_members?: ConversationAssignee | ConversationAssignee[] | null
  first_response_at?: string | null
  resolved_at?: string | null
  sla_breached?: boolean | null
  csat_sent_at?: string | null
  csat_score?: number | null
  csat_responded_at?: string | null
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

export interface MessageAttachment {
  url: string
  name: string
  size: number
  mime_type: string
}

/** Widget interactive UI snapshot stored on web chat assistant messages. */
export type MessageWidgetComponent = {
  type: string
  [key: string]: unknown
}

export interface Message {
  id: string
  client_id: string
  customer_phone: string
  role: 'user' | 'assistant' | 'human_agent' | 'system'
  content: string
  message_type?: 'text' | 'voice' | 'image' | 'file'
  attachments?: MessageAttachment[]
  /** Populated for web widget assistant replies (product grid, cart, booking, etc.). */
  components?: MessageWidgetComponent[]
  created_at: string
}

export interface ServiceBookingProfile {
  use_workspace_defaults: boolean
  ask_guest_count: boolean
  scheduling_mode?: SchedulingMode | null
  daily_capacity?: number | null
  max_guests_per_day?: number | null
}

export type BookingPaymentPolicy = 'none' | 'optional' | 'deposit' | 'full'
export type DepositType = 'percent' | 'fixed'

export interface Service {
  id: string
  client_id: string
  name: string
  duration_minutes: number
  description: string | null
  price?: number | null
  currency?: string
  is_active?: boolean
  booking_profile?: ServiceBookingProfile
  /** When/whether a booking for this service requires payment. */
  payment_policy?: BookingPaymentPolicy
  deposit_type?: DepositType | null
  deposit_value?: number | null
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

export interface BookingSlotsResponse {
  scheduling_mode: SchedulingMode
  slots: Slot[]
}

export type PaymentStatus = 'not_required' | 'pending' | 'paid' | 'failed'

export interface PaymentAccountStatus {
  provider: string
  status: 'not_connected' | 'pending' | 'active' | 'disabled'
  paystack_configured: boolean
  business_name?: string | null
  settlement_bank?: string | null
  account_number_last4?: string | null
  subaccount_code?: string | null
}

export interface SettlementBank {
  code: string
  name: string
}

/** Per-member Google Calendar connection status (one-way booking sync). */
export interface CalendarConnectionStatus {
  configured: boolean          // backend has Google OAuth credentials set
  connected: boolean           // this member has an active connection
  status?: 'active' | 'revoked' | 'error'
  google_account_email?: string | null
  calendar_id?: string | null
  is_business_default?: boolean
  last_synced_at?: string | null
}

export interface Booking {
  id: string
  client_id: string
  customer_phone: string
  customer_name: string
  customer_email?: string | null
  service_id: string
  booking_date: string  // "YYYY-MM-DD"
  booking_time: string  // "HH:MM"
  // 'reserved' = slot held (not yet confirmed) until a required deposit/prepayment is received.
  status: 'reserved' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  total_amount?: number | null
  currency?: string
  payment_link?: string | null
  payment_status?: PaymentStatus
  payment_reference?: string | null
  assigned_to: string | null
  assigned_at: string | null
  created_at: string
  booking_details?: Record<string, unknown> | null
  services: { name: string; duration_minutes: number; price?: number | null } | null
  assigned_member: { id: string; name: string; avatar_color: string | null; role: string; role_label: string | null } | null
}

export interface PortalTeamRowActions {
  change_role: boolean
  deactivate: boolean
  remove: boolean
}

export interface CustomRole {
  id: string
  client_id: string
  name: string
  permissions: string[]
  created_at: string
}

export interface PortalTeamRow {
  member_id: string | null
  user_id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'agent'
  is_active: boolean
  is_bookable: boolean
  conversation_count: number
  avatar_color: string | null
  is_self: boolean
  actions: PortalTeamRowActions
  custom_role: Pick<CustomRole, 'id' | 'name' | 'permissions'> | null
}

export interface BookableMember {
  id: string
  name: string
  avatar_color: string | null
  role: 'owner' | 'manager' | 'agent'
  role_label: string | null
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

// ── Industry templates ────────────────────────────────────────────────────────

export interface IndustryTemplate {
  id: string
  name: string
  description: string
  emoji: string
  tags: string[]
  system_prompt: string
  suggested_agent_name: string
  features: ('bookings' | 'ecommerce')[]
}

// ── SLA + CSAT ────────────────────────────────────────────────────────────────

export interface SlaCsatMetrics {
  avg_first_response_minutes: number | null
  sla_breach_rate: number | null
  total_sla_responses: number
  avg_csat_score: number | null
  csat_response_rate: number | null
  total_csat_responses: number
}

// ── Departments ───────────────────────────────────────────────────────────────

export interface Department {
  id: string
  client_id: string
  name: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DepartmentMember {
  id: string
  name: string
  avatar_color: string | null
  role: 'owner' | 'manager' | 'agent'
}

// ── Subscription & feature toggles ───────────────────────────────────────────

export interface Plan {
  id: string
  key: string
  name: string
  description: string | null
  price: number
  currency: string
  is_active: boolean
  /** Channel-model fields */
  kind?: 'channel' | 'addon'
  price_annual?: number | null
  included_conversations?: number | null
  overage_rate_usd?: number | null
  paddle_price_id_monthly?: string | null
  paddle_price_id_annual?: string | null
  /** WhatsApp / Meta (Tech-Provider billing) */
  included_wa_messages?: number | null
  wa_overage_rate_usd?: number | null
  /** Annotated fields — present when returned from get_subscription_detail */
  enabled?: boolean
  enabled_at?: string | null
  price_at_enable?: number | null
}

export interface ClientSubscription {
  id: string
  client_id: string
  base_price: number
  total_price: number
  currency: string
  status: 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled'
  current_period_start: string
  current_period_end: string
  created_at: string
  updated_at: string
  /** Channel-model + Paddle fields */
  plan_key?: string | null
  billing_cycle?: 'monthly' | 'annual'
  included_conversations?: number | null
  overage_rate_usd?: number | null
  period_conversations?: number
  overage_conversations?: number
  overage_accrued_usd?: number
  trial_ends_at?: string | null
  paddle_customer_id?: string | null
  paddle_subscription_id?: string | null
  /** WhatsApp / Meta (Tech-Provider billing) */
  included_wa_messages?: number | null
  wa_overage_rate_usd?: number | null
  period_wa_messages?: number
  wa_overage_messages?: number
  wa_overage_accrued_usd?: number
}

export interface SubscriptionDetail {
  subscription: ClientSubscription | null
  plans: Plan[]
  usage?: ClientUsageBilling
  /** Add-on keys the admin included in the free trial (portal toggles). */
  trial_eligible_addons?: string[]
}

export interface ToggleFeatureResponse {
  subscription: ClientSubscription
  features: Record<string, boolean>
}

// ── AI cost telemetry (admin only) ────────────────────────────────────────────

export interface UsageCallType {
  call_type: string
  calls: number
  cost_usd: number
  input_tokens: number
  cached_input_tokens: number
  output_tokens: number
}

export interface ClientUsageBilling {
  state: 'unlimited' | 'ok' | 'approaching' | 'over' | 'no_subscription'
  used: number
  included: number | null
  pct: number | null
  overage_conversations: number
  overage_accrued_usd: number
  overage_rate_usd?: number
  /** WhatsApp / Meta usage in the same period */
  wa_used?: number
  wa_included?: number | null
  wa_overage_messages?: number
  wa_overage_accrued_usd?: number
  wa_overage_rate_usd?: number
  period_start: string
  period_end: string
  plan_key?: string | null
  status?: string | null
}

export interface ClientUsage {
  period_days: number
  total_cost_usd: number
  conversations: number
  cost_per_conversation_usd: number
  by_call_type: UsageCallType[]
  billing?: ClientUsageBilling
}

// ── Chatbot widget ────────────────────────────────────────────────────────────

export interface WidgetConfig {
  widget_id: string
  welcome_message: string
  brand_color: string        // hex, e.g. "#6366f1"
  position: 'bottom-right' | 'bottom-left'
  collect_lead: boolean
  agent_name: string
  agent_tagline: string
  agent_avatar_url: string | null
  features?: {
    bookings?: boolean
    shopping?: boolean
  }
}

// ── E-commerce ────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  client_id: string
  name: string
  description: string | null
  price: number
  currency: string
  stock_quantity: number   // -1 = unlimited
  image_url: string | null
  category: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export interface OrderItem {
  product_id: string
  name: string
  price: number
  quantity: number
}

export interface Order {
  id: string
  client_id: string
  customer_phone: string
  customer_name: string | null
  customer_email?: string | null
  status: OrderStatus
  total_amount: number
  currency?: string
  items: OrderItem[]
  payment_link: string | null
  payment_status?: PaymentStatus
  payment_reference?: string | null
  assigned_to: string | null
  assigned_member: { id: string; name: string; avatar_color: string | null; role: string; role_label: string | null } | null
  created_at: string
  updated_at: string
}
