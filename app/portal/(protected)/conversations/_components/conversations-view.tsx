'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  Building2,
  ChevronDown,
  ChevronLeft,
  Loader2,
  MessageSquare,
  Mic,
  Search,
  Send,
  StickyNote,
  Trash2,
  UserCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  assignPortalConversation,
  createPortalConversationNote,
  deletePortalConversationNote,
  getDepartments,
  getMyConversations,
  getMyMessages,
  getPortalCollaborationContext,
  getPortalConversationNotes,
  PortalAuthError,
  sendReply,
  updateConversationDepartment,
  updateConversationStatus,
  type TokenGetter,
} from '@/lib/api'
import type {
  Conversation,
  ConversationAssignee,
  ConversationNote,
  Department,
  Message,
} from '@/lib/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  const last4 = digits.slice(-4)
  const ccLen = digits.startsWith('1') ? 1 : digits.length > 11 ? 3 : 2
  return `+${digits.slice(0, ccLen)} ** *** ${last4}`
}

function formatListTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diffMs = Date.now() - d.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncate(str: string | undefined, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function embedAssignee(conv: Conversation): ConversationAssignee | null {
  const tm = conv.team_members
  if (!tm) return null
  return Array.isArray(tm) ? tm[0] ?? null : tm
}

const LANGUAGE_NAMES: Record<string, string> = {
  af: 'Afrikaans',
  zu: 'Zulu',
  xh: 'Xhosa',
  st: 'Sotho',
  tn: 'Tswana',
  ts: 'Tsonga',
  pt: 'Portuguese',
  fr: 'French',
  ar: 'Arabic',
  hi: 'Hindi',
}

function sentimentColor(
  label?: string | null,
  score?: number | null
): 'green' | 'yellow' | 'red' | null {
  if (!label && score == null) return null
  if (label === 'very_negative' || (score != null && score < 0.3)) return 'red'
  if (label === 'negative' || (score != null && score < 0.6)) return 'yellow'
  return 'green'
}

function renderNoteWithMentions(content: string, memberNames: string[]): ReactNode {
  if (memberNames.length === 0) return content
  const escaped = memberNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))`, 'gi')
  const parts = content.split(pattern)
  return parts.map((part, i) =>
    pattern.test(part) ? (
      <span key={i} className="font-medium text-blue-600">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Conversation['status'] }) {
  if (status === 'human') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
        Needs attention
      </span>
    )
  }
  if (status === 'resolved') {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
        Resolved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-green-200">
      AI
    </span>
  )
}

function AssigneeAvatar({
  assignee,
  size = 'sm',
}: {
  assignee: ConversationAssignee | null
  size?: 'sm' | 'md'
}) {
  const dim = size === 'md' ? 'h-8 w-8 text-xs' : 'h-6 w-6 text-[10px]'
  if (!assignee) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-500 ${dim}`}
      >
        ?
      </div>
    )
  }
  const bg = assignee.avatar_color || '#6b7280'
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${dim}`}
      style={{ backgroundColor: bg }}
    >
      {initials(assignee.name)}
    </div>
  )
}

// ── Conversation list item ────────────────────────────────────────────────────

function ConversationItem({
  conv,
  selected,
  onClick,
  departments,
}: {
  conv: Conversation
  selected: boolean
  onClick: () => void
  departments: Department[]
}) {
  const hasUnread = (conv.unread_count ?? 0) > 0
  const timeStr = formatListTime(conv.last_message_at ?? conv.updated_at)
  const isHuman = conv.status === 'human'
  const assignee = embedAssignee(conv)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-gray-100 transition-colors ${
        selected
          ? 'bg-gray-100'
          : isHuman
            ? 'bg-amber-50/40 hover:bg-amber-50/70'
            : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-2 mb-1">
        <AssigneeAvatar assignee={assignee} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span
              className={`text-sm font-medium truncate ${
                hasUnread ? 'text-gray-900' : 'text-gray-700'
              }`}
            >
              {maskPhone(conv.customer_phone)}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {timeStr && <span className="text-xs text-gray-400">{timeStr}</span>}
              {hasUnread && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white shrink-0">
                  {conv.unread_count > 9 ? '9+' : conv.unread_count}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <p
              className={`text-xs truncate flex-1 ${hasUnread ? 'text-gray-600 font-medium' : 'text-gray-400'}`}
            >
              {conv.last_message ? (
                truncate(conv.last_message, 40)
              ) : (
                <span className="italic text-gray-300">No messages yet</span>
              )}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {(() => {
                const color = sentimentColor(conv.last_sentiment_label, conv.last_sentiment_score)
                if (!color) return null
                const cls =
                  color === 'red'
                    ? 'bg-red-400'
                    : color === 'yellow'
                      ? 'bg-yellow-400'
                      : 'bg-green-400'
                return (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${cls} shrink-0`}
                    title={conv.last_sentiment_label ?? ''}
                  />
                )
              })()}
              <StatusBadge status={conv.status} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {conv.department_id && departments.length > 0 && (() => {
              const dept = departments.find((d) => d.id === conv.department_id)
              if (!dept) return null
              return (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent ring-1 ring-accent/20">
                  <Building2 size={9} />
                  {dept.name}
                </span>
              )
            })()}
            {conv.csat_score != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-100">
                ★ {conv.csat_score}/5
              </span>
            )}
            {conv.sla_breached && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-red-100">
                SLA breached
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'system') {
    return (
      <div className="flex justify-center my-1">
        <span className="text-[11px] text-gray-500 bg-white/70 rounded-full px-3 py-1 max-w-[80%] text-center leading-relaxed">
          {message.content}
        </span>
      </div>
    )
  }

  const isOutbound = message.role === 'assistant' || message.role === 'human_agent'
  const isHumanAgent = message.role === 'human_agent'

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[72%] flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}>
        {isHumanAgent && (
          <span className="mb-0.5 px-1 text-[10px] font-medium text-blue-500">You</span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isHumanAgent
              ? 'rounded-tr-sm bg-blue-100 text-gray-800'
              : isOutbound
                ? 'rounded-tr-sm bg-[#dcf8c6] text-gray-800'
                : 'rounded-tl-sm bg-white border border-gray-200 text-gray-800'
          }`}
        >
          {message.content}
        </div>
        {message.message_type === 'voice' && (
          <span className="mt-0.5 px-1 flex items-center gap-1 text-[11px] text-gray-400 italic">
            <Mic size={10} strokeWidth={1.75} />
            Transcribed voice note
          </span>
        )}
        <span className="mt-1 px-1 text-[11px] text-gray-400">
          {formatMessageTime(message.created_at)}
        </span>
      </div>
    </div>
  )
}

// ── Status bar ────────────────────────────────────────────────────────────────

function StatusBar({
  status,
  onTakeOver,
  onHandBack,
  changing,
}: {
  status: Conversation['status']
  onTakeOver: () => void
  onHandBack: () => void
  changing: boolean
}) {
  if (status === 'resolved') {
    return (
      <div className="shrink-0 border-b border-gray-100 bg-gray-50 px-5 py-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-gray-400 shrink-0" />
        <p className="text-xs text-gray-500 flex-1">Conversation resolved</p>
      </div>
    )
  }

  if (status === 'human') {
    return (
      <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-5 py-2 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
        <p className="text-xs text-amber-700 flex-1 font-medium">Waiting for your reply</p>
        <button
          onClick={onHandBack}
          disabled={changing}
          className="inline-flex items-center gap-1.5 rounded-md bg-white border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
        >
          {changing ? <Loader2 size={11} className="animate-spin" /> : <Bot size={11} />}
          Hand back to AI
        </button>
      </div>
    )
  }

  return (
    <div className="shrink-0 border-b border-green-100 bg-green-50 px-5 py-2 flex items-center gap-2">
      <Bot size={13} strokeWidth={1.75} className="text-green-600 shrink-0" />
      <p className="text-xs text-green-700 flex-1">AI is handling this conversation</p>
      <button
        onClick={onTakeOver}
        disabled={changing}
        className="inline-flex items-center gap-1.5 rounded-md bg-white border border-green-200 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
      >
        {changing ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />}
        Take over
      </button>
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function NoConversationsState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-8">
      <div className="mb-4 rounded-full bg-gray-50 p-5">
        <MessageSquare size={28} strokeWidth={1.5} className="text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">No conversations yet</p>
      <p className="mt-1.5 text-xs text-gray-400 max-w-xs leading-relaxed">
        Share your WhatsApp number to get started. Customer messages will appear here.
      </p>
    </div>
  )
}

function NothingSelectedState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-8">
      <div className="mb-3 rounded-full bg-gray-50 p-4">
        <MessageSquare size={22} strokeWidth={1.5} className="text-gray-300" />
      </div>
      <p className="text-sm text-gray-400">Select a conversation to view messages</p>
    </div>
  )
}

function NoResultsState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
      <Search size={20} strokeWidth={1.5} className="text-gray-200 mb-2" />
      <p className="text-sm text-gray-400">No conversations match your search</p>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type ListTab = 'all' | 'mine' | 'unassigned' | 'attention' | 'resolved'

function TabBar({
  active,
  attentionCount,
  showMine,
  onChange,
}: {
  active: ListTab
  attentionCount: number
  showMine: boolean
  onChange: (tab: ListTab) => void
}) {
  const tabs: [ListTab, string][] = [
    ['all', 'All'],
    ...(showMine ? ([['mine', 'Mine']] as [ListTab, string][]) : []),
    ['unassigned', 'Unassigned'],
    ['attention', 'Needs attention'],
    ['resolved', 'Resolved'],
  ]

  return (
    <div className="flex flex-wrap border-b border-gray-100">
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`relative flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-medium transition-colors ${
            active === tab
              ? 'text-brand border-b-2 border-accent -mb-px'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {label}
          {tab === 'attention' && attentionCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-white">
              {attentionCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

type ThreadTab = 'messages' | 'notes'

// ── Main component ────────────────────────────────────────────────────────────

export default function ConversationsView({
  clientId,
  initialPhone,
}: {
  clientId: string
  initialPhone?: string | null
}) {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [listLoaded, setListLoaded] = useState(false)
  const [tab, setTab] = useState<ListTab>('all')
  const [search, setSearch] = useState('')
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [threadTab, setThreadTab] = useState<ThreadTab>('messages')
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [statusChanging, setStatusChanging] = useState(false)
  const [viewerMemberId, setViewerMemberId] = useState<string | null>(null)
  const [assignableMembers, setAssignableMembers] = useState<
    { id: string; name: string; avatar_color: string | null }[]
  >([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptOpen, setDeptOpen] = useState(false)
  const [deptAssigning, setDeptAssigning] = useState(false)
  const [deptFilter, setDeptFilter] = useState<string | null>(null)
  const [notes, setNotes] = useState<ConversationNote[]>([])
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [mentionPick, setMentionPick] = useState<{
    start: number
    query: string
    rect?: DOMRect
  } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const notesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedPhoneRef = useRef<string | null>(null)

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone
  }, [selectedPhone])

  useEffect(() => {
    if (initialPhone) setSelectedPhone(initialPhone)
  }, [initialPhone])

  const getFreshToken = useCallback<TokenGetter>(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }, [])

  const handleApiError = useCallback(
    (err: unknown, fallback: string) => {
      if (err instanceof PortalAuthError) {
        router.replace('/portal/login')
        return
      }
      console.error(fallback, err)
    },
    [router]
  )

  const refreshConversations = useCallback(async () => {
    try {
      const list = await getMyConversations(getFreshToken)
      setConversations(list)
    } catch (err) {
      handleApiError(err, 'Failed to load conversations')
    } finally {
      setListLoaded(true)
    }
  }, [getFreshToken, handleApiError])

  const scheduleRefetchConversations = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current)
    refetchTimer.current = setTimeout(() => {
      void refreshConversations()
    }, 450)
  }, [refreshConversations])

  useEffect(() => {
    void refreshConversations()
  }, [refreshConversations])

  useEffect(() => {
    Promise.all([
      getPortalCollaborationContext(getFreshToken),
      getDepartments(getFreshToken),
    ])
      .then(([ctx, depts]) => {
        setViewerMemberId(ctx.viewer_member_id ?? null)
        setAssignableMembers(
          ctx.members.map((m) => ({
            id: m.id,
            name: m.name,
            avatar_color: m.avatar_color ?? null,
          }))
        )
        setDepartments(depts.filter((d) => d.is_active))
      })
      .catch(() => {
        /* no collaboration access */
      })
  }, [getFreshToken])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('inbox')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setConversations((prev) => [payload.new as Conversation, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === (payload.new as Conversation).id ? { ...c, ...(payload.new as Conversation) } : c
              )
            )
            scheduleRefetchConversations()
          } else if (payload.eventType === 'DELETE') {
            setConversations((prev) =>
              prev.filter((c) => c.id !== (payload.old as Partial<Conversation>).id)
            )
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          if (msg.customer_phone !== selectedPhoneRef.current) return
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            const replacedIdx = prev.findIndex(
              (m) =>
                m.id.startsWith('optimistic-') &&
                m.role === msg.role &&
                m.content === msg.content
            )
            if (replacedIdx >= 0) {
              const next = prev.slice()
              next[replacedIdx] = msg
              return next
            }
            return [...prev, msg]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [clientId, scheduleRefetchConversations])

  useEffect(() => {
    if (!selectedPhone) return
    let cancelled = false
    setLoadingMessages(true)
    setMessages([])
    getMyMessages(getFreshToken, selectedPhone)
      .then((msgs) => {
        if (!cancelled) setMessages(msgs)
      })
      .catch((err) => {
        if (!cancelled) handleApiError(err, 'Failed to load messages:')
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedPhone, getFreshToken, handleApiError])

  useEffect(() => {
    if (!selectedPhone || threadTab !== 'notes') return
    let cancelled = false
    setLoadingNotes(true)
    getPortalConversationNotes(getFreshToken, selectedPhone)
      .then((n) => {
        if (!cancelled) setNotes(n)
      })
      .catch((err) => {
        if (!cancelled) handleApiError(err, 'Failed to load notes')
      })
      .finally(() => {
        if (!cancelled) setLoadingNotes(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedPhone, threadTab, getFreshToken, handleApiError])

  useEffect(() => {
    if (threadTab === 'messages' && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, threadTab])

  useEffect(() => {
    if (threadTab === 'notes' && notes.length > 0) {
      notesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [notes, threadTab])

  const selectedConv = conversations.find((c) => c.customer_phone === selectedPhone) ?? null
  const attentionCount = useMemo(
    () => conversations.filter((c) => c.status === 'human').length,
    [conversations]
  )

  const filtered = useMemo(() => {
    let list = conversations
    if (tab === 'mine' && viewerMemberId) {
      list = list.filter((c) => c.assigned_to === viewerMemberId)
    } else if (tab === 'unassigned') {
      list = list.filter((c) => !c.assigned_to)
    } else if (tab === 'attention') {
      list = list.filter((c) => c.status === 'human')
    } else if (tab === 'resolved') {
      list = list.filter((c) => c.status === 'resolved')
    }
    if (deptFilter) {
      list = list.filter((c) => c.department_id === deptFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.customer_phone.includes(q) || c.last_message?.toLowerCase().includes(q)
      )
    }
    return list
  }, [conversations, tab, search, viewerMemberId, deptFilter])

  const handleSelectConversation = useCallback((phone: string) => {
    setSelectedPhone(phone)
    setReplyText('')
    setNoteText('')
    setMentionPick(null)
    setThreadTab('messages')
    setAssignOpen(false)
    setDeptOpen(false)
  }, [])

  const handleReply = useCallback(async () => {
    const text = replyText.trim()
    if (!text || !selectedPhone || sending) return
    setSending(true)
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMessage: Message = {
      id: optimisticId,
      client_id: clientId,
      customer_phone: selectedPhone,
      role: 'human_agent',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMessage])
    setReplyText('')
    try {
      await sendReply(getFreshToken, selectedPhone, text)
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setReplyText(text)
      handleApiError(err, 'Failed to send reply:')
    } finally {
      setSending(false)
    }
  }, [replyText, selectedPhone, sending, clientId, getFreshToken, handleApiError])

  const handleSetStatus = useCallback(
    async (status: 'ai' | 'human' | 'resolved') => {
      if (!selectedPhone || statusChanging) return
      setStatusChanging(true)
      try {
        await updateConversationStatus(getFreshToken, selectedPhone, status)
      } catch (err) {
        handleApiError(err, 'Failed to update status:')
      } finally {
        setStatusChanging(false)
      }
    },
    [selectedPhone, statusChanging, getFreshToken, handleApiError]
  )

  const doAssign = useCallback(
    async (memberId: string | null) => {
      if (!selectedPhone || assigning) return
      setAssigning(true)
      try {
        const updated = await assignPortalConversation(getFreshToken, selectedPhone, memberId)
        const member = memberId ? assignableMembers.find((m) => m.id === memberId) : null
        setConversations((prev) =>
          prev.map((c) =>
            c.customer_phone === selectedPhone
              ? {
                  ...c,
                  ...updated,
                  team_members: member
                    ? { id: member.id, name: member.name, avatar_color: member.avatar_color }
                    : null,
                }
              : c
          )
        )
        setAssignOpen(false)
      } catch (err) {
        handleApiError(err, 'Failed to assign')
      } finally {
        setAssigning(false)
      }
    },
    [selectedPhone, assigning, getFreshToken, assignableMembers, handleApiError]
  )

  const doDeptRoute = useCallback(
    async (departmentId: string | null) => {
      if (!selectedPhone || deptAssigning) return
      setDeptAssigning(true)
      try {
        const updated = await updateConversationDepartment(getFreshToken, selectedPhone, departmentId)
        setConversations((prev) =>
          prev.map((c) =>
            c.customer_phone === selectedPhone ? { ...c, department_id: updated.department_id } : c
          )
        )
        setDeptOpen(false)
      } catch (err) {
        handleApiError(err, 'Failed to route conversation')
      } finally {
        setDeptAssigning(false)
      }
    },
    [selectedPhone, deptAssigning, getFreshToken, handleApiError]
  )

  const submitNote = useCallback(async () => {
    const t = noteText.trim()
    if (!t || !selectedPhone || noteSubmitting) return
    setNoteSubmitting(true)
    try {
      const n = await createPortalConversationNote(getFreshToken, selectedPhone, t)
      setNotes((prev) => [...prev, n])
      setNoteText('')
      setMentionPick(null)
    } catch (err) {
      handleApiError(err, 'Failed to add note')
    } finally {
      setNoteSubmitting(false)
    }
  }, [noteText, selectedPhone, noteSubmitting, getFreshToken, handleApiError])

  const removeNote = useCallback(
    async (noteId: string) => {
      if (!selectedPhone) return
      try {
        await deletePortalConversationNote(getFreshToken, selectedPhone, noteId)
        setNotes((prev) => prev.filter((n) => n.id !== noteId))
      } catch (err) {
        handleApiError(err, 'Failed to delete note')
      }
    },
    [selectedPhone, getFreshToken, handleApiError]
  )

  function onNoteInputChange(value: string) {
    setNoteText(value)
    const el = textareaRef.current
    if (!el) return
    const pos = el.selectionStart
    const before = value.slice(0, pos)
    const m = /(?:^|\s)@([\w\s]*)$/.exec(before)
    if (m) {
      setMentionPick({ start: pos - m[1].length - 1, query: m[1].toLowerCase() })
    } else {
      setMentionPick(null)
    }
  }

  function insertMention(memberName: string) {
    if (!mentionPick) return
    const el = textareaRef.current
    const caret = el?.selectionStart ?? noteText.length
    const before = noteText.slice(0, mentionPick.start)
    const after = noteText.slice(caret)
    const insert = `@${memberName} `
    const next = before + insert + after
    setNoteText(next)
    setMentionPick(null)
    requestAnimationFrame(() => {
      if (el) {
        const c = before.length + insert.length
        el.focus()
        el.setSelectionRange(c, c)
      }
    })
  }

  const mentionChoices = useMemo(() => {
    if (!mentionPick) return []
    const q = mentionPick.query.trim()
    return assignableMembers.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8)
  }, [mentionPick, assignableMembers])

  const headerAssignee = selectedConv ? embedAssignee(selectedConv) : null
  const isEmpty = listLoaded && conversations.length === 0

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] md:h-[calc(100vh-3rem)] overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className={`flex-none flex-col border-r border-gray-100 w-full md:w-72 md:flex ${selectedPhone ? 'hidden' : 'flex'}`}>
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
          {!isEmpty && listLoaded && (
            <p className="text-xs text-gray-400 mt-0.5">{conversations.length} total</p>
          )}
        </div>

        {!isEmpty && listLoaded && (
          <TabBar
            active={tab}
            attentionCount={attentionCount}
            showMine={!!viewerMemberId}
            onChange={setTab}
          />
        )}

        {!isEmpty && listLoaded && (
          <div className="border-b border-gray-100 px-3 py-2.5 space-y-2">
            <div className="relative">
              <Search
                size={13}
                strokeWidth={2}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by number or message…"
                className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-7 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-0"
              />
            </div>
            {departments.length > 0 && (
              <select
                value={deptFilter ?? ''}
                onChange={(e) => setDeptFilter(e.target.value || null)}
                className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 px-2.5 text-xs text-gray-700 focus:border-gray-400 focus:outline-none"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {!listLoaded ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-gray-300" size={22} />
            </div>
          ) : isEmpty ? (
            <NoConversationsState />
          ) : filtered.length === 0 ? (
            <NoResultsState />
          ) : (
            filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                selected={conv.customer_phone === selectedPhone}
                onClick={() => handleSelectConversation(conv.customer_phone)}
                departments={departments}
              />
            ))
          )}
        </div>
      </div>

      <div className={`flex-1 flex-col overflow-hidden w-full md:flex ${!selectedPhone ? 'hidden' : 'flex'}`}>
        {!selectedConv ? (
          <NothingSelectedState />
        ) : (
          <>
            <div className="shrink-0 border-b border-gray-100 px-3 md:px-5 py-3.5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedPhone(null)}
                  className="md:hidden mt-0.5 shrink-0 rounded-md p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft size={18} strokeWidth={1.75} />
                </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">
                    {maskPhone(selectedConv.customer_phone)}
                  </p>
                  {selectedConv.detected_language && selectedConv.detected_language !== 'en' && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                      🌍{' '}
                      {LANGUAGE_NAMES[selectedConv.detected_language] ??
                        selectedConv.detected_language.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{selectedConv.customer_phone}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Member assignment */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setAssignOpen((v) => !v); setDeptOpen(false) }}
                      disabled={assigning}
                      className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-left text-xs hover:bg-gray-50 disabled:opacity-50"
                    >
                      <AssigneeAvatar assignee={headerAssignee} size="md" />
                      <span className="font-medium text-gray-800">
                        {headerAssignee ? headerAssignee.name : 'Unassigned'}
                      </span>
                      {assigning ? (
                        <Loader2 size={12} className="animate-spin text-gray-400" />
                      ) : (
                        <ChevronDown size={14} className="text-gray-400" />
                      )}
                    </button>
                    {assignOpen && (
                      <div className="absolute left-0 top-full z-30 mt-1 min-w-[220px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                          onClick={() => void doAssign(null)}
                        >
                          Unassign
                        </button>
                        {assignableMembers.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
                            onClick={() => void doAssign(m.id)}
                          >
                            <AssigneeAvatar
                              assignee={{ id: m.id, name: m.name, avatar_color: m.avatar_color }}
                              size="sm"
                            />
                            <span className="text-gray-800">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Department routing */}
                  {departments.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => { setDeptOpen((v) => !v); setAssignOpen(false) }}
                        disabled={deptAssigning}
                        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-left text-xs hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Building2 size={13} className="text-gray-400" />
                        <span className="font-medium text-gray-800">
                          {selectedConv.department_id
                            ? (departments.find((d) => d.id === selectedConv.department_id)?.name ?? 'Department')
                            : 'Route to team'}
                        </span>
                        {deptAssigning ? (
                          <Loader2 size={12} className="animate-spin text-gray-400" />
                        ) : (
                          <ChevronDown size={14} className="text-gray-400" />
                        )}
                      </button>
                      {deptOpen && (
                        <div className="absolute left-0 top-full z-30 mt-1 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          {selectedConv.department_id && (
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-left text-xs text-gray-500 hover:bg-gray-50"
                              onClick={() => void doDeptRoute(null)}
                            >
                              Remove from team
                            </button>
                          )}
                          {departments.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 ${
                                selectedConv.department_id === d.id ? 'text-accent font-medium' : 'text-gray-800'
                              }`}
                              onClick={() => void doDeptRoute(d.id)}
                            >
                              <Building2 size={12} className="text-gray-400 shrink-0" />
                              {d.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              </div>
              {selectedConv.status === 'human' && (
                <button
                  type="button"
                  onClick={() => handleSetStatus('resolved')}
                  disabled={statusChanging}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 shrink-0"
                >
                  Mark resolved
                </button>
              )}
            </div>

            <StatusBar
              status={selectedConv.status}
              onTakeOver={() => handleSetStatus('human')}
              onHandBack={() => handleSetStatus('ai')}
              changing={statusChanging}
            />

            {selectedConv.summary ? (
              <div className="shrink-0 border-b border-gray-100 bg-gray-50 px-5 py-2">
                <button
                  type="button"
                  onClick={() => setSummaryExpanded(v => !v)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className="text-sm shrink-0">📝</span>
                  <span className="text-xs font-medium text-gray-600 shrink-0">Summary</span>
                  {!summaryExpanded && (
                    <span className="text-xs text-gray-400 truncate flex-1">{selectedConv.summary}</span>
                  )}
                  <ChevronDown
                    size={14}
                    className={`ml-auto shrink-0 text-gray-400 transition-transform ${summaryExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {summaryExpanded && (
                  <p className="mt-1.5 text-xs text-gray-500 leading-relaxed pl-6">{selectedConv.summary}</p>
                )}
              </div>
            ) : selectedConv.status === 'ai' || selectedConv.status === 'human' ? (
              <div className="shrink-0 border-b border-gray-100 bg-gray-50 px-5 py-2 flex items-center gap-2">
                <span className="text-sm">📝</span>
                <p className="text-xs text-gray-400 italic">Generating summary…</p>
              </div>
            ) : null}

            <div className="flex border-b border-gray-100 bg-gray-50/80 px-5">
              <button
                type="button"
                onClick={() => setThreadTab('messages')}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                  threadTab === 'messages'
                    ? 'border-accent text-brand'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare size={14} strokeWidth={1.75} />
                Messages
              </button>
              <button
                type="button"
                onClick={() => setThreadTab('notes')}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                  threadTab === 'notes'
                    ? 'border-accent text-brand'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <StickyNote size={14} strokeWidth={1.75} />
                Notes
              </button>
            </div>

            {threadTab === 'messages' ? (
              <div className="flex-1 overflow-y-auto bg-[#e5ddd5] px-5 py-4 space-y-3 min-h-0">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 size={20} strokeWidth={1.75} className="animate-spin text-gray-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-xs text-gray-500 bg-white/60 rounded-full px-3 py-1">
                      No messages in this conversation
                    </p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg) => (
                      <MessageBubble key={msg.id} message={msg} />
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col min-h-0 bg-gray-50">
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {loadingNotes ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="animate-spin text-gray-400" size={20} />
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="text-center text-xs text-gray-400 py-8">
                      No internal notes yet. Add one below — customers never see these.
                    </p>
                  ) : (
                    notes.map((n) => {
                      const author = n.team_members
                        ? Array.isArray(n.team_members)
                          ? n.team_members[0]
                          : n.team_members
                        : null
                      const color = author?.avatar_color || '#6b7280'
                      return (
                        <div key={n.id} className="flex gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: color }}
                          >
                            {initials(n.author_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="text-xs font-semibold text-gray-900">
                                  {n.author_name}
                                </span>
                                <span className="text-[10px] text-gray-400 ml-2">
                                  {formatMessageTime(n.created_at)}
                                </span>
                              </div>
                              {n.can_delete && (
                                <button
                                  type="button"
                                  onClick={() => void removeNote(n.id)}
                                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                  aria-label="Delete note"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            <p className="mt-1.5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {renderNoteWithMentions(n.content, assignableMembers.map((m) => m.name))}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={notesEndRef} />
                </div>
                <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={noteText}
                      onChange={(e) => onNoteInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setMentionPick(null)
                      }}
                      placeholder={
                        'Add an internal note…\nUse @name to mention a teammate'
                      }
                      rows={3}
                      className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-0"
                    />
                    {mentionPick && mentionChoices.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-1 max-h-40 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-md z-10">
                        {mentionChoices.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50"
                            onClick={() => insertMention(m.name)}
                          >
                            <AssigneeAvatar
                              assignee={{ id: m.id, name: m.name, avatar_color: m.avatar_color }}
                              size="sm"
                            />
                            {m.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void submitNote()}
                      disabled={!noteText.trim() || noteSubmitting}
                      className="rounded-md bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-40"
                    >
                      {noteSubmitting ? 'Adding…' : 'Add note'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {threadTab === 'messages' &&
              (selectedConv.status === 'human' ? (
                <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleReply()
                        }
                      }}
                      placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none focus:ring-0"
                    />
                    <button
                      type="button"
                      onClick={handleReply}
                      disabled={!replyText.trim() || sending}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500 text-white transition-colors hover:bg-green-600 disabled:opacity-40"
                    >
                      {sending ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Send size={15} strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </div>
              ) : selectedConv.status === 'ai' ? (
                <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Your AI agent handles replies automatically</p>
                  <button
                    type="button"
                    onClick={() => handleSetStatus('human')}
                    disabled={statusChanging}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {statusChanging ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <UserCheck size={11} />
                    )}
                    Take over
                  </button>
                </div>
              ) : (
                <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400">This conversation has been resolved</p>
                  <button
                    type="button"
                    onClick={() => handleSetStatus('ai')}
                    disabled={statusChanging}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {statusChanging ? <Loader2 size={11} className="animate-spin" /> : <Bot size={11} />}
                    Reopen with AI
                  </button>
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  )
}
