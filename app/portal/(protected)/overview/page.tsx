import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Calendar, MessageSquare, BookOpen, Zap, Clock, ArrowUpRight, PhoneCall, Star, ShieldAlert } from 'lucide-react'
import { getClientProfile, createClient, getPortalAccessToken } from '@/lib/supabase/server'
import { getMyKnowledgeFiles, getMyConversations, getMyOnboarding, getSlaCsatMetrics } from '@/lib/api'
import type { Booking, KnowledgeFile, Conversation, OnboardingStatus, SlaCsatMetrics } from '@/lib/types'
import { Card } from '@/components/ui'

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const ts = new Date(dateStr).getTime()
  if (isNaN(ts)) return '—'
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ── Agent Status Card ────────────────────────────────────────────────────────

function AgentStatusCard({
  isActive,
  waPhoneNumber,
}: {
  isActive: boolean
  waPhoneNumber: string
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Agent status</p>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ${
                isActive
                  ? 'bg-success-soft text-success ring-success/25'
                  : 'bg-danger-soft text-danger ring-danger/25'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-success' : 'bg-danger'}`}
              />
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {waPhoneNumber && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-ink-2">
              <PhoneCall size={13} strokeWidth={1.75} />
              <span>{waPhoneNumber}</span>
            </div>
          )}
        </div>
        <div className={`rounded-lg p-2.5 ring-1 ${isActive ? 'bg-success-soft ring-success/25' : 'bg-surface-2 ring-line'}`}>
          <Zap size={18} strokeWidth={1.75} className={isActive ? 'text-success' : 'text-ink-3'} />
        </div>
      </div>
      <p className="mt-4 text-sm text-ink-2">
        {isActive
          ? 'Your AI agent is live and handling messages.'
          : 'Your AI agent is currently inactive. Contact us to enable it.'}
      </p>
    </Card>
  )
}

// ── Quick Stats Row ──────────────────────────────────────────────────────────

function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function QuickStatsRow({ metrics }: { metrics: SlaCsatMetrics | null }) {
  const avgResponse = metrics?.avg_first_response_minutes ?? null
  const breachRate = metrics?.sla_breach_rate ?? null
  const csatScore = metrics?.avg_csat_score ?? null

  const stats = [
    {
      label: 'Avg. first response',
      value: formatResponseTime(avgResponse),
      sub: metrics?.total_sla_responses ? `${metrics.total_sla_responses} responses` : 'No data yet',
      icon: Clock,
      alert: false,
    },
    {
      label: 'SLA breach rate',
      value: breachRate !== null ? `${breachRate}%` : '—',
      sub: breachRate !== null && breachRate > 20 ? 'Needs attention' : 'Within target',
      icon: ShieldAlert,
      alert: breachRate !== null && breachRate > 20,
    },
    {
      label: 'Avg. CSAT score',
      value: csatScore !== null ? `${csatScore}/5` : '—',
      sub: metrics?.total_csat_responses ? `${metrics.total_csat_responses} ratings` : 'No ratings yet',
      icon: Star,
      alert: false,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map(({ label, value, sub, icon: Icon, alert }) => (
        <div
          key={label}
          className={`rounded-xl border bg-surface p-5 shadow-card ${alert ? 'border-danger/30' : 'border-line'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</p>
            <span className={`rounded-md p-1.5 ring-1 ${alert ? 'bg-danger-soft ring-danger/25' : 'bg-accent-soft ring-accent/15'}`}>
              <Icon size={13} strokeWidth={1.75} className={alert ? 'text-danger' : 'text-accent'} />
            </span>
          </div>
          <p className={`mt-2 text-2xl font-semibold tracking-tight ${alert ? 'text-danger' : 'text-ink'}`}>{value}</p>
          <p className="mt-0.5 text-xs text-ink-3">{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Knowledge Base Status Card ───────────────────────────────────────────────

function KnowledgeStatusCard({ files }: { files: KnowledgeFile[] }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Knowledge base</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{files.length}</p>
          <p className="text-sm text-ink-2">{files.length === 1 ? 'document' : 'documents'} uploaded</p>
        </div>
        <div className="rounded-lg bg-accent-soft p-2.5 ring-1 ring-accent/15">
          <BookOpen size={18} strokeWidth={1.75} className="text-accent-text/70" />
        </div>
      </div>
      <div className="mt-4">
        <Link
          href="/portal/knowledge-base"
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2 transition-colors"
        >
          <BookOpen size={12} strokeWidth={1.75} />
          Add documents
        </Link>
      </div>
    </Card>
  )
}

// ── Recent Activity Card ─────────────────────────────────────────────────────

function RecentActivityCard({ conversations }: { conversations: Conversation[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Recent activity</p>
        {conversations.length > 0 && (
          <Link
            href="/portal/conversations"
            className="text-xs font-medium text-ink-2 hover:text-ink transition-colors"
          >
            View all
          </Link>
        )}
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MessageSquare size={24} strokeWidth={1.5} className="text-ink-3/50 mb-2" />
          <p className="text-sm text-ink-3">No conversations yet</p>
          <p className="text-xs text-ink-3 mt-0.5">Messages will appear here once your agent starts responding.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line/60 -mx-6 px-6">
          {conversations.map((conv) => (
            <li key={conv.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2">
                  <MessageSquare size={12} strokeWidth={1.75} className="text-ink-3" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink-2 font-medium">{conv.customer_phone}</p>
                  {conv.last_message && (
                    <p className="text-xs text-ink-3 truncate">{conv.last_message}</p>
                  )}
                </div>
              </div>
              <span className="ml-4 shrink-0 text-xs text-ink-3">
                {formatRelativeTime(conv.last_message_at ?? conv.updated_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ── Today's Bookings Card ────────────────────────────────────────────────────

function TodaysBookingsCard({ bookings }: { bookings: Booking[] }) {
  function formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Today&apos;s bookings</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{bookings.length}</p>
          <p className="text-sm text-ink-2">{bookings.length === 1 ? 'appointment' : 'appointments'} today</p>
        </div>
        <div className="rounded-lg bg-accent-soft p-2.5 ring-1 ring-accent/15">
          <Calendar size={18} strokeWidth={1.75} className="text-accent" />
        </div>
      </div>

      {bookings.length === 0 ? (
        <p className="text-sm text-ink-3">No bookings scheduled for today.</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-2">{b.customer_name}</p>
                <p className="text-xs text-ink-3">{b.services?.name ?? 'Unknown service'}</p>
              </div>
              <span className="ml-3 shrink-0 text-xs font-medium text-ink-2">
                {formatTime(b.booking_time)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Link
          href="/portal/bookings"
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2 transition-colors"
        >
          <Calendar size={12} strokeWidth={1.75} />
          View all bookings
        </Link>
      </div>
    </Card>
  )
}

// ── Onboarding progress card ─────────────────────────────────────────────────

function OnboardingProgressCard({ status }: { status: OnboardingStatus | null }) {
  if (!status || status.completed_at) return null

  const steps = Object.values(status.steps)
  const resolved = steps.filter((s) => s.done || s.skipped).length
  if (resolved >= steps.length) return null

  return (
    <Link href="/portal/onboarding" className="block">
      <Card className="border-accent/30 transition-shadow hover:shadow-card-hover">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-accent-text">
              Finish setting up
            </p>
            <p className="mt-1 text-sm text-ink-2">
              {resolved} of {steps.length} steps done — pick up where you left off.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${(resolved / steps.length) * 100}%` }}
              />
            </div>
            <ArrowUpRight size={16} strokeWidth={2} className="text-accent-text" />
          </div>
        </div>
      </Card>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PortalOverviewPage() {
  const client = await getClientProfile()

  if (!client) {
    redirect('/portal/login')
  }

  // Get the session token for portal API calls
  const supabase = await createClient()
  const token = (await getPortalAccessToken()) ?? ''

  let files: KnowledgeFile[] = []
  let conversations: Conversation[] = []
  let needsAttentionCount = 0
  let todaysBookings: Booking[] = []
  let slaCsatMetrics: SlaCsatMetrics | null = null
  let onboarding: OnboardingStatus | null = null

  const todayStr = new Date().toISOString().slice(0, 10)

  await Promise.allSettled([
    token
      ? getMyKnowledgeFiles(token).then((f) => { files = f })
      : Promise.resolve(),
    token
      ? getMyConversations(token).then((all) => {
          needsAttentionCount = all.filter(
            (c) => c.status === 'human' && (c.unread_count ?? 0) > 0
          ).length
          conversations = all.slice(0, 5)
        })
      : Promise.resolve(),
    token
      ? getSlaCsatMetrics(token).then((m) => { slaCsatMetrics = m }).catch(() => {})
      : Promise.resolve(),
    token
      ? getMyOnboarding(token).then((o) => { onboarding = o }).catch(() => {})
      : Promise.resolve(),
    supabase
      .from('bookings')
      .select('*, services(name, duration_minutes)')
      .eq('client_id', client.id)
      .eq('booking_date', todayStr)
      .neq('status', 'cancelled')
      .order('booking_time', { ascending: true })
      .limit(3)
      .then(({ data }) => { todaysBookings = (data ?? []) as Booking[] }),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {needsAttentionCount > 0 && (
        <Link
          href="/portal/conversations?status=human"
          className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 transition-colors hover:bg-danger-soft"
        >
          <span className="text-base leading-none">⚠️</span>
          <p className="flex-1 text-sm font-medium text-danger">
            {needsAttentionCount} conversation{needsAttentionCount > 1 ? 's' : ''} need{needsAttentionCount === 1 ? 's' : ''} your attention
          </p>
          <ArrowUpRight size={14} strokeWidth={2} className="shrink-0 text-danger" />
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-2">{client.business_name}</p>
      </div>

      {/* New-user onboarding first — it only renders while setup is incomplete,
          and those users need it before any metrics. */}
      <OnboardingProgressCard status={onboarding} />

      <QuickStatsRow metrics={slaCsatMetrics} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AgentStatusCard isActive={client.is_active} waPhoneNumber={client.wa_phone_number} />
        <TodaysBookingsCard bookings={todaysBookings} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KnowledgeStatusCard files={files} />
        <RecentActivityCard conversations={conversations} />
      </div>
    </div>
  )
}
