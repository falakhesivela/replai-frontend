import { notFound } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { getClient, getKnowledgeFiles, getClientConversations } from '@/lib/api.server'
import type { Client, KnowledgeFile, Conversation } from '@/lib/types'
import SystemPromptCard from './_components/system-prompt-card'
import KnowledgeCard from './_components/knowledge-card'

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  const last4 = digits.slice(-4)
  const ccLen = digits.startsWith('1') ? 1 : digits.length > 11 ? 3 : 2
  return `+${digits.slice(0, ccLen)} ** *** ${last4}`
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function truncate(str: string | undefined, max: number): string {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ── Conversations section ─────────────────────────────────────────────────────

function ConvStatusBadge({ status }: { status: Conversation['status'] }) {
  if (status === 'human') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
        Needs attention
      </span>
    )
  }
  if (status === 'resolved') {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
        Resolved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200">
      AI
    </span>
  )
}

function ConversationsCard({ conversations }: { conversations: Conversation[] }) {
  const attentionCount = conversations.filter((c) => c.status === 'human').length

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Card header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <MessageSquare size={15} strokeWidth={1.75} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Conversations</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {conversations.length}
          </span>
        </div>
        {attentionCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
            {attentionCount} need{attentionCount === 1 ? 's' : ''} attention
          </span>
        )}
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare size={22} strokeWidth={1.5} className="mb-2 text-gray-200" />
          <p className="text-sm text-gray-400">No conversations yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Customer', 'Status', 'Last message', 'Last active', 'Messages'].map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversations.map((conv) => (
                <tr
                  key={conv.id}
                  className={`transition-colors ${
                    conv.status === 'human' ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="whitespace-nowrap px-6 py-3.5 text-sm font-medium text-gray-900">
                    {maskPhone(conv.customer_phone)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-3.5">
                    <ConvStatusBadge status={conv.status} />
                  </td>
                  <td className="max-w-[240px] px-6 py-3.5 text-sm text-gray-500">
                    <span className="block truncate">{truncate(conv.last_message, 60)}</span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-sm text-gray-400">
                    {formatRelativeTime(conv.last_message_at)}
                  </td>
                  <td className="whitespace-nowrap px-6 py-3.5 text-sm text-gray-500">
                    {conv.message_count ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let client: Client
  let files: KnowledgeFile[] = []
  let conversations: Conversation[] = []

  try {
    client = await getClient(id)
  } catch {
    notFound()
  }

  await Promise.allSettled([
    getKnowledgeFiles(id).then((f) => { files = f }),
    getClientConversations(id).then((c) => { conversations = c }),
  ])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{client.business_name}</h2>
          {client.wa_phone_number && (
            <p className="mt-0.5 text-sm text-gray-500">{client.wa_phone_number}</p>
          )}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
            client.is_active
              ? 'bg-green-50 text-green-700 ring-green-600/20'
              : 'bg-gray-100 text-gray-500 ring-gray-500/20'
          }`}
        >
          {client.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* ── AI Configuration ── */}
      <SystemPromptCard clientId={id} initialPrompt={client.system_prompt} />

      {/* ── Knowledge base ── */}
      <KnowledgeCard clientId={id} initialFiles={files} />

      {/* ── Conversations ── */}
      <ConversationsCard conversations={conversations} />
    </div>
  )
}
