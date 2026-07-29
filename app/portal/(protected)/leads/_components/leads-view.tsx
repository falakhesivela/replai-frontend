'use client'

import { useState } from 'react'
import { Target, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { clearMyLeads, deleteMyLead, type TokenGetter } from '@/lib/api'
import type { Lead } from '@/lib/types'
import { usePermissions } from '@/hooks/usePermissions'
import { useToast } from '@/components/toast'
import { ConfirmDialog, EmptyState } from '@/components/ui'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function formatContact(lead: Lead): string {
  if (lead.email) return lead.email
  if (lead.phone && !lead.phone.startsWith('web_')) return lead.phone
  return '—'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const SOURCE_LABELS: Record<Lead['source'], string> = {
  website: 'Website',
  whatsapp: 'WhatsApp',
}

type Props = {
  initialLeads: Lead[]
}

export default function LeadsView({ initialLeads }: Props) {
  const { toast } = useToast()
  const { can } = usePermissions()
  const canManageLeads = can('manage_leads')
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  async function remove(id: string) {
    if (!canManageLeads) return
    setBusyId(id)
    try {
      await deleteMyLead(getFreshToken, id)
      setLeads((prev) => prev.filter((l) => l.id !== id))
      toast.success('Lead removed')
    } catch {
      toast.error('Failed to remove lead')
    } finally {
      setBusyId(null)
    }
  }

  async function clearAll() {
    if (!canManageLeads || leads.length === 0) return
    setConfirmClear(false)
    setClearing(true)
    try {
      await clearMyLeads(getFreshToken)
      setLeads([])
      toast.success('All leads cleared')
    } catch {
      toast.error('Failed to clear leads')
    } finally {
      setClearing(false)
    }
  }

  const colCount = canManageLeads ? 6 : 5

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Leads</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            Prospects captured from your website widget and WhatsApp conversations.
          </p>
        </div>
        {canManageLeads && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={leads.length === 0 || clearing}
            className="rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {clearing ? 'Clearing…' : 'Clear all'}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-xs font-medium text-ink-2">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Added</th>
                {canManageLeads && <th className="w-28 px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={colCount}>
                    <EmptyState
                      icon={Target}
                      title="No leads yet"
                      description="They appear here when visitors submit the pre-chat form or when your agent captures contact details in chat."
                    />
                  </td>
                </tr>
              ) : (
                leads.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3 font-medium text-ink">
                      {row.name || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-ink-2">{formatContact(row)}</td>
                    <td className="px-4 py-3 text-ink-2">{SOURCE_LABELS[row.source]}</td>
                    <td className="px-4 py-3 text-ink-2">
                      {row.tags?.length ? row.tags.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-2">{formatDate(row.created_at)}</td>
                    {canManageLeads && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => remove(row.id)}
                          disabled={busyId === row.id}
                          className="inline-flex items-center gap-1 rounded-md border border-danger/30 px-2 py-1 text-xs font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
                          aria-label={`Remove ${row.name || 'lead'}`}
                        >
                          <Trash2 size={13} strokeWidth={1.75} />
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear all leads"
          description="Remove all leads from this list? This cannot be undone."
          confirmLabel="Clear all"
          onConfirm={clearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  )
}
