'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getPortalNotifications,
  markPortalNotificationsRead,
  PortalAuthError,
} from '@/lib/api'
import type { PortalNotification } from '@/lib/types'

export default function PortalNotificationsBell({ teamMemberId }: { teamMemberId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<PortalNotification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const getToken = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const refresh = useCallback(async () => {
    try {
      const list = await getPortalNotifications(getToken)
      setItems(list)
    } catch (e) {
      if (e instanceof PortalAuthError && e.status === 401) {
        // Only redirect if the session is actually gone — a transient 401
        // during initial mount can fire while the session is still settling.
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.replace('/portal/login')
        }
      }
    }
  }, [getToken, router])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    async function subscribe() {
      const token = await getToken()
      if (!token || cancelled) return

      // Realtime uses a separate WebSocket connection — it does NOT inherit the
      // browser session automatically.  We must set the JWT explicitly so that
      // Supabase can evaluate the RLS policies on the notifications table.
      supabase.realtime.setAuth(token)

      channel = supabase
        .channel(`notifications-${teamMemberId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `team_member_id=eq.${teamMemberId}`,
          },
          () => {
            void refresh()
          }
        )
        .subscribe()
    }

    void subscribe()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [teamMemberId, refresh, getToken])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return
      if (panelRef.current?.contains(e.target as Node)) return
      const t = e.target as HTMLElement
      if (t.closest('[data-notification-bell]')) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const unread = items.filter((n) => !n.is_read).length

  async function markAllRead() {
    setLoading(true)
    try {
      await markPortalNotificationsRead(getToken, null)
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  function goToConversation(n: PortalNotification) {
    const phone = n.conversation_phone
    if (phone) {
      router.push(`/portal/conversations?phone=${encodeURIComponent(phone)}`)
    }
    setOpen(false)
    if (!n.is_read) {
      void markPortalNotificationsRead(getToken, n.id).then(() => refresh())
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        data-notification-bell
        onClick={() => {
          setOpen((v) => !v)
          if (!open) void refresh()
        }}
        className="relative rounded-md p-2 text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-on-solid">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border border-line bg-overlay shadow-overlay z-50 flex flex-col max-h-96">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-xs font-semibold text-ink">Notifications</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={loading || unread === 0}
                className="text-[11px] font-medium text-ink-2 hover:text-ink disabled:opacity-40"
              >
                Mark all read
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-ink-3 hover:text-ink-2 rounded"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-ink-3">No notifications yet</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => goToConversation(n)}
                  className={`w-full text-left px-3 py-2.5 border-b border-line/60 hover:bg-surface-2 transition-colors ${
                    !n.is_read ? 'bg-violet-50/40' : ''
                  }`}
                >
                  <p className="text-xs font-medium text-ink">{n.title}</p>
                  <p className="text-[11px] text-ink-2 mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-ink-3 mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
          {loading && (
            <div className="flex justify-center py-2 border-t border-line">
              <Loader2 size={14} className="animate-spin text-ink-3" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
