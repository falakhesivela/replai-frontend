'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  Loader2,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMyBroadcast, PortalAuthError, type TokenGetter } from '@/lib/api'
import type { BroadcastDetail, BroadcastRecipient } from '@/lib/types'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RecipientStatusIcon({ status }: { status: BroadcastRecipient['status'] }) {
  if (status === 'sent')
    return <CheckCircle size={14} strokeWidth={1.75} className="text-green-500 shrink-0" />
  if (status === 'failed')
    return <XCircle size={14} strokeWidth={1.75} className="text-red-400 shrink-0" />
  return <Clock size={14} strokeWidth={1.75} className="text-amber-400 shrink-0" />
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(broadcast: BroadcastDetail) {
  const rows = [
    ['Phone', 'Name', 'Status'],
    ...broadcast.recipients.map((r) => [r.phone, r.name ?? '', r.status]),
  ]
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `broadcast-${broadcast.id.slice(0, 8)}-results.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BroadcastDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [broadcast, setBroadcast] = useState<BroadcastDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof createClient>['channel'] extends (arg: string) => infer R ? R : never | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getMyBroadcast(getFreshToken, id)
      setBroadcast(data)
    } catch (e) {
      if (e instanceof PortalAuthError) router.replace('/portal/login')
    }
  }, [id, router])

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [refresh])

  // Realtime: subscribe to broadcast row + recipient updates
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function subscribe() {
      const token = await getFreshToken()
      if (!token) return
      supabase.realtime.setAuth(token)

      channel = supabase
        .channel(`broadcast-detail-${id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'broadcasts', filter: `id=eq.${id}` },
          () => { void refresh() }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'broadcast_recipients', filter: `broadcast_id=eq.${id}` },
          () => { void refresh() }
        )
        .subscribe()
    }

    void subscribe()
    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [id, refresh])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-gray-300" />
      </div>
    )
  }

  if (!broadcast) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-gray-500">Broadcast not found</p>
        <button
          type="button"
          onClick={() => router.push('/portal/broadcasts')}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Back to broadcasts
        </button>
      </div>
    )
  }

  // Use broadcast-level counters as the source of truth for stats — these are
  // updated in real time by run_broadcast. The recipients array may be empty
  // if broadcast_recipients rows haven't landed yet (RLS/timing), so never
  // derive stats from it.
  const total = broadcast.total_recipients
  const sent = broadcast.sent_count
  const failed = broadcast.failed_count
  const pending = Math.max(0, total - sent - failed)
  const deliveryRate = total > 0 ? Math.round((sent / total) * 100) : 0
  const progress = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-8 max-w-4xl">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/portal/broadcasts')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        Broadcasts
      </button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{broadcast.name}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {broadcast.sent_at
              ? `Sent ${formatDateTime(broadcast.sent_at)}`
              : broadcast.scheduled_at
              ? `Scheduled for ${formatDateTime(broadcast.scheduled_at)}`
              : `Created ${formatDateTime(broadcast.created_at)}`}
          </p>
        </div>
        {(broadcast.recipients.length > 0 || sent > 0) && (
          <button
            type="button"
            onClick={() => exportCsv(broadcast)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={14} strokeWidth={1.75} />
            Export CSV
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Sent', value: sent, color: 'text-green-600' },
          { label: 'Failed', value: failed, color: 'text-red-500' },
          { label: 'Pending', value: pending, color: 'text-amber-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border border-gray-100 bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <p className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="rounded-lg border border-gray-100 bg-white px-5 py-4 mb-6">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>Progress</span>
            <span className="tabular-nums font-medium text-gray-900">
              {sent + failed} / {total}
              <span className="text-gray-400 ml-1">({deliveryRate}% delivered)</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#1E0B6F] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {broadcast.status === 'sending' && (
            <p className="text-[11px] text-blue-500 mt-1.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3D6BF8] animate-pulse inline-block" />
              Sending in progress…
            </p>
          )}
        </div>
      )}

      {/* Message preview */}
      <div className="rounded-lg border border-gray-100 bg-white px-5 py-4 mb-6">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Message</p>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{broadcast.message}</p>
      </div>

      {/* Recipients */}
      {broadcast.recipients.length > 0 && (
        <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Recipients ({total})
            </p>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {broadcast.recipients.map((r, i) => (
                <tr key={`${r.phone}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{r.phone}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.name ?? <span className="text-gray-300 italic">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <RecipientStatusIcon status={r.status} />
                      <span className={`text-xs capitalize ${
                        r.status === 'sent' ? 'text-green-600' :
                        r.status === 'failed' ? 'text-red-500' : 'text-amber-600'
                      }`}>{r.status}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
