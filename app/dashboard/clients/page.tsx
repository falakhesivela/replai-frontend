import Link from 'next/link'
import { Users } from 'lucide-react'
import { getClients, getClientConversations } from '@/lib/api.server'
import type { Client, Conversation } from '@/lib/types'
import { PageHeader, Badge, EmptyState, buttonClasses } from '@/components/ui'

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ConvStats {
  total: number
  needsAttention: number
}

function StatusBadge({ is_active }: { is_active: Client['is_active'] }) {
  return (
    <Badge tone={is_active ? 'success' : 'neutral'}>
      {is_active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

function ConvStatsCell({ stats }: { stats: ConvStats | undefined }) {
  if (!stats) {
    return <span className="text-sm text-gray-300">—</span>
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{stats.total}</span>
      {stats.needsAttention > 0 && (
        <Badge tone="warning">
          {stats.needsAttention} need{stats.needsAttention === 1 ? 's' : ''} attention
        </Badge>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClientsPage() {
  let clients: Client[] = []
  let fetchError = false
  let fetchErrorMsg: string | null = null

  try {
    clients = await getClients()
  } catch (err) {
    fetchError = true
    fetchErrorMsg = err instanceof Error ? err.message : String(err)
    // Surface the real cause in the dashboard server logs.
    console.error('[dashboard] getClients() failed:', err)
  }

  // Fetch conversation stats for all clients in parallel — failures are silent
  const convStatsMap = new Map<string, ConvStats>()
  if (clients.length > 0) {
    const results = await Promise.allSettled(
      clients.map((c) => getClientConversations(c.id))
    )
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        const convs: Conversation[] = result.value
        convStatsMap.set(clients[i].id, {
          total: convs.length,
          needsAttention: convs.filter((c) => c.status === 'human').length,
        })
      }
    })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Clients"
        actions={
          <Link href="/dashboard/clients/new" className={buttonClasses()}>
            Add client
          </Link>
        }
      />

      {fetchError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600">
          <p className="font-medium">Failed to load clients.</p>
          {fetchErrorMsg && (
            <p className="mt-1 font-mono text-xs text-red-500">{fetchErrorMsg}</p>
          )}
          <p className="mt-2 text-xs text-red-500">
            Check NEXT_PUBLIC_API_URL (or INTERNAL_API_URL) and ADMIN_API_KEY in
            the dashboard env match the running API. Full traceback is in the
            dashboard server logs.
          </p>
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Users}
          title="No clients yet"
          description="Get started by adding your first client."
          action={
            <Link href="/dashboard/clients/new" className={buttonClasses()}>
              Add your first client
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Business name', 'WhatsApp number', 'Status', 'Conversations', 'Actions'].map(
                  (col) => (
                    <th
                      key={col}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {client.business_name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {client.wa_phone_number ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <StatusBadge is_active={client.is_active} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <ConvStatsCell stats={convStatsMap.get(client.id)} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <Link
                      href={`/dashboard/clients/${client.id}`}
                      className={buttonClasses({ variant: 'secondary', size: 'sm' })}
                    >
                      Manage
                    </Link>
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
