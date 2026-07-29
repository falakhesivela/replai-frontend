'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  CalendarCheck,
  Clock,
  MessageSquare,
  MessagesSquare,
  RefreshCw,
  ShoppingBag,
  Star,
  Target,
} from 'lucide-react'
import {
  Badge,
  Card,
  PageHeader,
  Progress,
  StatCard,
  TableShell,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui'
import { ChartCard } from '@/components/charts/chart-card'
import { LineChart } from '@/components/charts/line-chart'
import { StackedBarChart } from '@/components/charts/stacked-bar-chart'
import { useChartTheme } from '@/components/charts/use-chart-theme'
import type {
  AnalyticsOverview,
  Broadcast,
  SentimentMetrics,
  SlaCsatMetrics,
  UsageMetrics,
} from '@/lib/types'

export type RangeKey = '7d' | '30d' | '90d' | 'custom'

// Fixed categorical slots — color follows the entity across every chart.
const SLOT_AI = 0
const SLOT_HUMAN = 1
const SLOT_RESPONSE = 2
const SLOT_CSAT = 3
const SLOT_POSITIVE = 4

function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return ((cur - prev) / prev) * 100
}

function fmtMinutes(mins: number | null): string {
  if (mins === null) return '—'
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

function RangePicker({ active }: { active: RangeKey }) {
  const router = useRouter()
  const sp = useSearchParams()

  function setRange(key: RangeKey) {
    const params = new URLSearchParams(sp.toString())
    params.set('range', key)
    params.delete('start')
    params.delete('end')
    router.push(`/portal/analytics?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
      {(['7d', '30d', '90d'] as const).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => setRange(key)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            active === key
              ? 'bg-accent-soft text-accent-text'
              : 'text-ink-3 hover:text-ink'
          }`}
        >
          {key === '7d' ? '7 days' : key === '30d' ? '30 days' : '90 days'}
        </button>
      ))}
    </div>
  )
}

interface AnalyticsViewProps {
  rangeKey: RangeKey
  rangeStart: string
  rangeEnd: string
  overview: AnalyticsOverview | null
  slaCsat: SlaCsatMetrics | null
  sentiment: SentimentMetrics | null
  usage: UsageMetrics | null
  broadcasts: Broadcast[]
  showBookings: boolean
  showOrders: boolean
}

export default function AnalyticsView({
  rangeKey,
  rangeStart,
  rangeEnd,
  overview,
  slaCsat,
  sentiment,
  usage,
  broadcasts,
  showBookings,
  showOrders,
}: AnalyticsViewProps) {
  const router = useRouter()
  const { ink3 } = useChartTheme()

  const totals = overview?.totals
  const prev = overview?.previous
  const caption = `${fmtDay(rangeStart)} – ${fmtDay(rangeEnd)}`

  const resolutionRate =
    totals && totals.conversations > 0
      ? Math.round((totals.resolved / totals.conversations) * 100)
      : null

  const convSeries = overview?.series ?? []
  const slaSeries = slaCsat?.series ?? []
  const sentSeries = sentiment?.series ?? []
  const sentTotals = sentiment?.totals
  const hasSentiment =
    !!sentTotals && sentTotals.positive + sentTotals.neutral + sentTotals.negative > 0

  const recentBroadcasts = broadcasts
    .filter((b) => b.status !== 'draft')
    .slice(0, 8)

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analytics"
        description={`How your agent performed · ${caption}`}
        actions={
          <div className="flex items-center gap-2">
            <RangePicker active={rangeKey} />
            <button
              type="button"
              onClick={() => router.refresh()}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw size={13} strokeWidth={1.75} />
            </button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Conversations"
          value={totals?.conversations ?? '—'}
          icon={MessageSquare}
          delta={totals && prev ? pctDelta(totals.conversations, prev.conversations) : null}
          caption="vs previous period"
        />
        <StatCard
          label="Messages in"
          value={totals?.messages_in ?? '—'}
          icon={MessagesSquare}
          delta={totals && prev ? pctDelta(totals.messages_in, prev.messages_in) : null}
          caption="vs previous period"
        />
        <StatCard
          label="First response"
          value={fmtMinutes(slaCsat?.avg_first_response_minutes ?? null)}
          icon={Clock}
          caption={
            slaCsat?.sla_breach_rate != null
              ? `${slaCsat.sla_breach_rate}% SLA breaches`
              : 'No data yet'
          }
        />
        <StatCard
          label="Resolution rate"
          value={resolutionRate != null ? `${resolutionRate}%` : '—'}
          caption={totals ? `${totals.resolved} resolved` : undefined}
        />
        <StatCard
          label="CSAT"
          value={
            slaCsat?.avg_csat_score != null ? `${slaCsat.avg_csat_score}/5` : '—'
          }
          icon={Star}
          caption={
            slaCsat?.total_csat_responses
              ? `${slaCsat.total_csat_responses} ratings`
              : 'No ratings yet'
          }
        />
        <StatCard
          label="Leads"
          value={totals?.leads ?? '—'}
          icon={Target}
          delta={totals && prev ? pctDelta(totals.leads, prev.leads) : null}
          caption="vs previous period"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Conversations over time */}
        <ChartCard
          title="Conversations handled"
          caption="AI-handled vs human-handled, per day"
          table={{
            columns: [
              { key: 'date', label: 'Date' },
              { key: 'ai_handled', label: 'AI' },
              { key: 'human_handled', label: 'Human' },
              { key: 'conversations', label: 'New' },
            ],
            rows: convSeries.map((d) => ({ ...d, date: fmtDay(d.date) })),
          }}
        >
          <LineChart
            data={convSeries}
            xKey="date"
            xFormat={fmtDay}
            series={[
              { key: 'ai_handled', label: 'AI handled', slot: SLOT_AI },
              { key: 'human_handled', label: 'Human handled', slot: SLOT_HUMAN },
            ]}
          />
        </ChartCard>

        {/* Message volume */}
        <ChartCard
          title="Message volume"
          caption="Inbound vs outbound messages, per day"
          table={{
            columns: [
              { key: 'date', label: 'Date' },
              { key: 'messages_in', label: 'In' },
              { key: 'messages_out', label: 'Out' },
            ],
            rows: convSeries.map((d) => ({ ...d, date: fmtDay(d.date) })),
          }}
        >
          <LineChart
            data={convSeries}
            xKey="date"
            xFormat={fmtDay}
            series={[
              { key: 'messages_in', label: 'Inbound', slot: SLOT_AI },
              { key: 'messages_out', label: 'Outbound', slot: SLOT_HUMAN },
            ]}
          />
        </ChartCard>

        {/* Response time */}
        <ChartCard
          title="First response time"
          caption="Daily average, minutes"
          table={{
            columns: [
              { key: 'date', label: 'Date' },
              { key: 'avg_first_response_minutes', label: 'Avg (min)' },
              { key: 'breaches', label: 'Breaches' },
            ],
            rows: slaSeries.map((d) => ({ ...d, date: fmtDay(d.date) })),
          }}
        >
          <LineChart
            data={slaSeries}
            xKey="date"
            xFormat={fmtDay}
            series={[
              {
                key: 'avg_first_response_minutes',
                label: 'Avg first response (min)',
                slot: SLOT_RESPONSE,
              },
            ]}
          />
        </ChartCard>

        {/* CSAT trend */}
        <ChartCard
          title="Customer satisfaction"
          caption={`Daily average CSAT (1–5) · ${slaCsat?.csat_response_rate != null ? `${slaCsat.csat_response_rate}% response rate` : 'no surveys answered yet'}`}
          table={{
            columns: [
              { key: 'date', label: 'Date' },
              { key: 'csat_avg', label: 'Avg' },
              { key: 'csat_count', label: 'Ratings' },
            ],
            rows: slaSeries.map((d) => ({ ...d, date: fmtDay(d.date) })),
          }}
        >
          <LineChart
            data={slaSeries}
            xKey="date"
            xFormat={fmtDay}
            series={[{ key: 'csat_avg', label: 'CSAT', slot: SLOT_CSAT }]}
          />
        </ChartCard>
      </div>

      {/* Sentiment */}
      {hasSentiment && (
        <div className="mt-4">
          <ChartCard
            title="Conversation sentiment"
            caption="Based on the customer's most recent messages"
            table={{
              columns: [
                { key: 'date', label: 'Date' },
                { key: 'positive', label: 'Positive' },
                { key: 'neutral', label: 'Neutral' },
                { key: 'negative', label: 'Negative' },
              ],
              rows: sentSeries.map((d) => ({ ...d, date: fmtDay(d.date) })),
            }}
          >
            <StackedBarChart
              data={sentSeries}
              xKey="date"
              xFormat={fmtDay}
              series={[
                { key: 'positive', label: 'Positive', slot: SLOT_POSITIVE },
                { key: 'neutral', label: 'Neutral', slot: 0, color: ink3 },
                { key: 'negative', label: 'Negative', slot: 3 },
              ]}
            />
          </ChartCard>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Plan usage */}
        {usage && (
          <Card padding="sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Plan usage</p>
              <Badge
                tone={
                  usage.state === 'over'
                    ? 'danger'
                    : usage.state === 'approaching'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {usage.state === 'over'
                  ? 'Over cap'
                  : usage.state === 'approaching'
                    ? 'Near cap'
                    : usage.state === 'unlimited'
                      ? 'Unlimited'
                      : usage.state === 'no_subscription'
                        ? 'No plan'
                        : 'On plan'}
              </Badge>
            </div>
            <div className="space-y-4">
              <Progress
                value={
                  usage.included
                    ? (usage.used / usage.included) * 100
                    : usage.used > 0
                      ? 100
                      : 0
                }
                label={`Conversations · ${usage.used}${usage.included != null ? ` / ${usage.included}` : ''}`}
              />
              <Progress
                value={
                  usage.wa_included
                    ? (usage.wa_used / usage.wa_included) * 100
                    : usage.wa_used > 0
                      ? 100
                      : 0
                }
                label={`WhatsApp messages · ${usage.wa_used}${usage.wa_included != null ? ` / ${usage.wa_included}` : ''}`}
              />
              {(usage.overage_accrued_usd > 0 || usage.wa_overage_accrued_usd > 0) && (
                <p className="text-xs text-warning">
                  Overage accrued: $
                  {(usage.overage_accrued_usd + usage.wa_overage_accrued_usd).toFixed(2)}
                </p>
              )}
              <p className="text-xs text-ink-3">
                Billing period {fmtDay(usage.period_start.slice(0, 10))} –{' '}
                {fmtDay(usage.period_end.slice(0, 10))}
              </p>
            </div>
          </Card>
        )}

        {/* Bookings / orders */}
        {(showBookings || showOrders) && (
          <div className="grid grid-cols-2 gap-4">
            {showBookings && (
              <StatCard
                label="Bookings"
                value={totals?.bookings ?? '—'}
                icon={CalendarCheck}
                delta={totals && prev ? pctDelta(totals.bookings, prev.bookings) : null}
                caption="vs previous period"
              />
            )}
            {showOrders && (
              <StatCard
                label="Orders"
                value={totals?.orders ?? '—'}
                icon={ShoppingBag}
                delta={totals && prev ? pctDelta(totals.orders, prev.orders) : null}
                caption="vs previous period"
              />
            )}
          </div>
        )}
      </div>

      {/* Broadcast performance */}
      {recentBroadcasts.length > 0 && (
        <div className="mt-4">
          <p className="mb-3 text-sm font-semibold text-ink">Broadcast performance</p>
          <TableShell>
            <THead>
              <Th>Campaign</Th>
              <Th>Status</Th>
              <Th className="text-right">Recipients</Th>
              <Th className="text-right">Sent</Th>
              <Th className="text-right">Failed</Th>
              <Th className="text-right">Delivery</Th>
            </THead>
            <TBody>
              {recentBroadcasts.map((b) => {
                const delivery =
                  b.total_recipients > 0
                    ? Math.round((b.sent_count / b.total_recipients) * 100)
                    : null
                return (
                  <Tr key={b.id}>
                    <Td className="font-medium text-ink">{b.name}</Td>
                    <Td>
                      <Badge
                        tone={
                          b.status === 'sent'
                            ? 'success'
                            : b.status === 'failed'
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {b.status}
                      </Badge>
                    </Td>
                    <Td className="text-right font-mono tabular-nums">
                      {b.total_recipients}
                    </Td>
                    <Td className="text-right font-mono tabular-nums">{b.sent_count}</Td>
                    <Td className="text-right font-mono tabular-nums">{b.failed_count}</Td>
                    <Td className="text-right font-mono tabular-nums">
                      {delivery != null ? `${delivery}%` : '—'}
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </TableShell>
        </div>
      )}
    </div>
  )
}
