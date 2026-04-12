import Link from 'next/link'
import { Users } from 'lucide-react'
import { getClients, getClientConversations } from '@/lib/api.server'
import type { Client, Conversation } from '@/lib/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ConvStats {
  total: number
  needsAttention: number
}

function StatusBadge({ is_active }: { is_active: Client['is_active'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        is_active
          ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20'
          : 'bg-gray-100 text-gray-500 ring-1 ring-gray-500/20'
      }`}
    >
      {is_active ? 'Active' : 'Inactive'}
    </span>
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
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
          {stats.needsAttention} need{stats.needsAttention === 1 ? 's' : ''} attention
        </span>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClientsPage() {
  let clients: Client[] = []
  let fetchError = false

  try {
    clients = await getClients()
  } catch {
    fetchError = true
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
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-gray-900">Clients</h2>
        <Link
          href="/dashboard/clients/new"
          className="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Add client
        </Link>
      </div>

      {fetchError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600">
          Failed to load clients. Make sure the API server is running.
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Users size={22} className="text-gray-400" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-gray-900">No clients yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding your first client.
          </p>
          <Link
            href="/dashboard/clients/new"
            className="mt-5 inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            Add your first client
          </Link>
        </div>
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
                      className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
