'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PortalAuthError, getActivityLog, getPortalTeamDirectory } from '@/lib/api'
import type { ActivityLogEntry, PortalTeamRow } from '@/lib/types'
import { usePermissions } from '@/hooks/usePermissions'

const PAGE_SIZE = 25

const ACTION_LABELS: Record<string, string> = {
  replied_to_conversation: 'Replied to a conversation',
  assigned_conversation: 'Assigned a conversation',
  escalated_conversation: 'Escalated a conversation',
  resolved_conversation: 'Resolved a conversation',
  added_note: 'Added a note',
  uploaded_document: 'Uploaded a document',
  updated_agent: 'Updated the agent',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ')
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function hashColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  const hue = Math.abs(h) % 360
  return `hsl(${hue}, 55%, 45%)`
}

export function ActivityFeed() {
  const { can } = usePermissions()
  const router = useRouter()

  const getAccessToken = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const [entries, setEntries] = useState<ActivityLogEntry[]>([])
  const [members, setMembers] = useState<Pick<PortalTeamRow, 'member_id' | 'name'>[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [memberFilter, setMemberFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const initialized = useRef(false)

  // Redirect agents — they don't have manage_team
  useEffect(() => {
    if (!can('manage_team')) {
      router.replace('/portal/overview')
    }
  }, [can, router])

  const fetchPage = useCallback(
    async (pageNum: number, memberId: string, append: boolean) => {
      try {
        const data = await getActivityLog(getAccessToken, {
          member_id: memberId || undefined,
          page: pageNum,
          limit: PAGE_SIZE,
        })
        setEntries((prev) => (append ? [...prev, ...data] : data))
        setHasMore(data.length === PAGE_SIZE)
      } catch (e) {
        if (e instanceof PortalAuthError) {
          if (e.status === 403) { router.replace('/portal/overview'); return }
          router.replace('/portal/login'); return
        }
        setError(e instanceof Error ? e.message : 'Failed to load activity')
      }
    },
    [getAccessToken, router]
  )

  // Initial load: fetch members + first page
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function init() {
      setLoading(true)
      try {
        const [dir] = await Promise.all([
          getPortalTeamDirectory(getAccessToken).catch(() => null),
        ])
        if (dir) {
          setMembers(
            dir.rows
              .filter((r) => r.member_id !== null)
              .map((r) => ({ member_id: r.member_id, name: r.name }))
          )
        }
        await fetchPage(1, '', false)
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [getAccessToken, fetchPage])

  // Re-fetch when filter changes
  useEffect(() => {
    if (!initialized.current) return
    setPage(1)
    setLoading(true)
    void fetchPage(1, memberFilter, false).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberFilter])

  async function loadMore() {
    const next = page + 1
    setPage(next)
    setLoadingMore(true)
    await fetchPage(next, memberFilter, true)
    setLoadingMore(false)
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Activity</h1>
          <p className="mt-1 text-sm text-gray-500">Last 7 days of team actions</p>
        </div>

        {/* Member filter */}
        <select
          value={memberFilter}
          onChange={(e) => setMemberFilter(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 w-full sm:w-52"
        >
          <option value="">All members</option>
          {members.map((m) => (
            <option key={m.member_id} value={m.member_id!}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="animate-spin" size={18} />
          Loading activity…
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 px-5 py-10 text-center">
          <p className="text-sm text-gray-500">No activity yet.</p>
        </div>
      ) : (
        <ol className="relative border-l border-gray-200 space-y-0">
          {entries.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} />
          ))}
        </ol>
      )}

      {hasMore && !loading && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function ActivityItem({ entry }: { entry: ActivityLogEntry }) {
  const color = hashColor(entry.member_name)

  return (
    <li className="ml-6 pb-8">
      {/* Timeline dot + avatar */}
      <span className="absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm ring-2 ring-white"
        style={{ backgroundColor: color }}>
        {initials(entry.member_name)}
      </span>

      <div className="pl-2">
        <p className="text-sm text-gray-900">
          <span className="font-medium">{entry.member_name}</span>
          {' '}
          <span className="text-gray-600">{actionLabel(entry.action)}</span>
          {entry.details && (
            <span className="ml-1 text-gray-500 font-mono text-xs">
              — {entry.details}
            </span>
          )}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
          <time dateTime={entry.created_at}>{timeAgo(entry.created_at)}</time>
          {entry.conversation_phone && (
            <span className="font-mono">{entry.conversation_phone}</span>
          )}
        </div>
      </div>
    </li>
  )
}
