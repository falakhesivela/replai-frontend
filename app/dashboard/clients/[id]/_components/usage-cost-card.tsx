import { DollarSign } from 'lucide-react'
import type { ClientUsage } from '@/lib/types'
import { Card } from '@/components/ui'

function usd(amount: number, fractionDigits = 4) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: fractionDigits,
  }).format(amount)
}

const CALL_TYPE_LABELS: Record<string, string> = {
  main_loop: 'Main reply loop',
  tool_followup: 'Tool follow-up',
  format_pass: 'Format pass',
  playground: 'Playground',
  claude_fallback: 'Claude fallback',
  language_detect: 'Language detect',
  sentiment: 'Sentiment',
  summary: 'Summary',
  embeddings: 'Embeddings',
  voice_transcription: 'Voice transcription',
}

const STATE_STYLE: Record<string, { label: string; cls: string }> = {
  ok: { label: 'On plan', cls: 'bg-green-100 text-green-700' },
  approaching: { label: 'Near cap', cls: 'bg-amber-100 text-amber-700' },
  over: { label: 'Over cap', cls: 'bg-red-100 text-red-600' },
  unlimited: { label: 'Unlimited', cls: 'bg-gray-100 text-gray-500' },
  no_subscription: { label: 'No subscription', cls: 'bg-gray-100 text-gray-500' },
}

export default function UsageCostCard({ usage }: { usage: ClientUsage }) {
  const { total_cost_usd, conversations, cost_per_conversation_usd, by_call_type } =
    usage
  const max = Math.max(...by_call_type.map((b) => b.cost_usd), 0.000001)
  const b = usage.billing
  const st = b ? STATE_STYLE[b.state] ?? STATE_STYLE.no_subscription : null
  const capPct =
    b && b.included ? Math.min(100, Math.round((b.used / b.included) * 100)) : 0

  return (
    <Card>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={15} strokeWidth={1.75} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            AI cost
            <span className="ml-2 text-xs font-normal text-gray-400">
              last {usage.period_days} days
            </span>
          </h3>
        </div>
        <p className="text-right text-sm font-semibold text-gray-900">
          {usd(total_cost_usd, 2)}
        </p>
      </div>

      {/* Top-line metrics */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">Conversations</p>
          <p className="text-sm font-semibold text-gray-900">
            {conversations.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-400">Cost / conversation</p>
          <p className="text-sm font-semibold text-gray-900">
            {conversations ? usd(cost_per_conversation_usd) : '—'}
          </p>
        </div>
      </div>

      {/* Current-period billing status */}
      {b && st && (
        <div className="mb-5 rounded-lg border border-gray-100 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-600">
              Billing period
              {b.plan_key && (
                <span className="ml-2 text-gray-400">· {b.plan_key}</span>
              )}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${st.cls}`}
            >
              {st.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900">
            {b.used.toLocaleString()}
            {b.included != null
              ? ` / ${b.included.toLocaleString()} conversations`
              : ' conversations (no cap)'}
          </p>
          {b.included != null && (
            <div className="mt-2 h-1.5 rounded-full bg-gray-100">
              <div
                className={`h-1.5 rounded-full ${
                  b.state === 'over'
                    ? 'bg-red-500'
                    : b.state === 'approaching'
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                }`}
                style={{ width: `${capPct}%` }}
              />
            </div>
          )}
          {b.overage_conversations > 0 && (
            <p className="mt-2 text-xs text-red-600">
              {b.overage_conversations.toLocaleString()} over ·{' '}
              {usd(b.overage_accrued_usd, 2)} overage accrued
              <span className="text-gray-400">
                {' '}
                (not yet charged — Paddle pending)
              </span>
            </p>
          )}
        </div>
      )}

      {/* WhatsApp messages — Tech-Provider billing */}
      {b &&
        (b.wa_included != null && (b.wa_included > 0 || (b.wa_used ?? 0) > 0)) && (
          <div className="mb-5 rounded-lg border border-gray-100 p-4">
            <p className="mb-2 text-xs font-medium text-gray-600">
              WhatsApp messages
              <span className="ml-2 text-gray-400">· Meta passthrough</span>
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {(b.wa_used ?? 0).toLocaleString()}
              {b.wa_included != null
                ? ` / ${b.wa_included.toLocaleString()} billable`
                : ' billable'}
            </p>
            {b.wa_included != null && b.wa_included > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-gray-100">
                <div
                  className={`h-1.5 rounded-full ${
                    (b.wa_overage_messages ?? 0) > 0
                      ? 'bg-red-500'
                      : (b.wa_used ?? 0) / b.wa_included >= 0.8
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((b.wa_used ?? 0) / b.wa_included) * 100)
                    )}%`,
                  }}
                />
              </div>
            )}
            {(b.wa_overage_messages ?? 0) > 0 && (
              <p className="mt-2 text-xs text-red-600">
                {(b.wa_overage_messages ?? 0).toLocaleString()} over ·{' '}
                {usd(b.wa_overage_accrued_usd ?? 0, 2)} overage accrued
                <span className="text-gray-400">
                  {' '}
                  (not yet charged — Paddle pending)
                </span>
              </p>
            )}
          </div>
        )}

      {/* Breakdown by call type */}
      {by_call_type.length > 0 ? (
        <div className="space-y-2">
          {by_call_type.map((b) => (
            <div key={b.call_type} className="flex items-center gap-3">
              <div className="w-32 shrink-0 text-xs text-gray-600">
                {CALL_TYPE_LABELS[b.call_type] ?? b.call_type}
              </div>
              <div className="h-1.5 flex-1 rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-gray-800"
                  style={{ width: `${(b.cost_usd / max) * 100}%` }}
                />
              </div>
              <div className="w-28 shrink-0 text-right text-xs text-gray-500">
                {usd(b.cost_usd)}
                <span className="ml-1 text-gray-300">
                  · {b.calls.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          No usage recorded yet. Confirm the{' '}
          <code className="text-gray-500">ai_usage_events</code> migration has
          been applied in Supabase.
        </p>
      )}

      {/* Caveats */}
      <p className="mt-5 border-t border-gray-100 pt-3 text-[11px] leading-relaxed text-gray-400">
        Internal cost data — never shown to the client. Voice costs are
        estimated from audio size. Margin vs plan price appears once USD pricing
        is finalised (Phase&nbsp;3).
      </p>
    </Card>
  )
}
