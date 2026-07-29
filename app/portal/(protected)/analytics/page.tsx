import { redirect } from 'next/navigation'
import { getClientProfile, getPortalAccessToken } from '@/lib/supabase/server'
import {
  getAnalyticsOverview,
  getMyBroadcasts,
  getSentimentMetrics,
  getSlaCsatMetrics,
  getUsageMetrics,
} from '@/lib/api'
import { isFeatureUnlocked } from '@/lib/entitlements.server'
import type {
  AnalyticsOverview,
  Broadcast,
  SentimentMetrics,
  SlaCsatMetrics,
  UsageMetrics,
} from '@/lib/types'
import AnalyticsView, { type RangeKey } from './_components/analytics-view'

const RANGE_DAYS: Record<Exclude<RangeKey, 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function resolveRange(params: {
  range?: string
  start?: string
  end?: string
}): { key: RangeKey; start: string; end: string } {
  if (params.range === 'custom' && params.start && params.end) {
    return { key: 'custom', start: params.start, end: params.end }
  }
  const key: RangeKey =
    params.range === '7d' || params.range === '90d' ? params.range : '30d'
  const end = new Date()
  const start = new Date(end.getTime() - RANGE_DAYS[key] * 86_400_000)
  return { key, start: isoDate(start), end: isoDate(end) }
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>
}) {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  const params = await searchParams
  const range = resolveRange(params)

  const token = (await getPortalAccessToken()) ?? ''

  let overview: AnalyticsOverview | null = null
  let slaCsat: SlaCsatMetrics | null = null
  let sentiment: SentimentMetrics | null = null
  let usage: UsageMetrics | null = null
  let broadcasts: Broadcast[] = []

  if (token) {
    const window = { start: range.start, end: range.end }
    await Promise.allSettled([
      getAnalyticsOverview(token, window).then((d) => {
        overview = d
      }),
      getSlaCsatMetrics(token, window).then((d) => {
        slaCsat = d
      }),
      getSentimentMetrics(token, window).then((d) => {
        sentiment = d
      }),
      getUsageMetrics(token).then((d) => {
        usage = d
      }),
      getMyBroadcasts(token).then((d) => {
        broadcasts = d
      }),
    ])
  }

  const [showBookings, showOrders, showBroadcasts] = await Promise.all([
    isFeatureUnlocked('bookings'),
    isFeatureUnlocked('shopping'),
    isFeatureUnlocked('broadcasts'),
  ])

  return (
    <AnalyticsView
      rangeKey={range.key}
      rangeStart={range.start}
      rangeEnd={range.end}
      overview={overview}
      slaCsat={slaCsat}
      sentiment={sentiment}
      usage={usage}
      broadcasts={showBroadcasts ? broadcasts : []}
      showBookings={showBookings}
      showOrders={showOrders}
    />
  )
}
