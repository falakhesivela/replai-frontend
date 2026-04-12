'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'

type LeadRow = { id: string; name: string; phone: string; source: string }

/**
 * Client-side list until a portal leads API exists. Delete / clear all are gated by `manage_leads`.
 */
export default function LeadsPage() {
  const { can } = usePermissions()
  const canManageLeads = can('manage_leads')
  const [leads, setLeads] = useState<LeadRow[]>([])

  function clearAll() {
    if (!canManageLeads || leads.length === 0) return
    if (!window.confirm('Remove all leads from this list?')) return
    setLeads([])
  }

  function remove(id: string) {
    setLeads((prev) => prev.filter((l) => l.id !== id))
  }

  const colCount = canManageLeads ? 4 : 3

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Prospects from your channels. This view will sync with your backend once connected.
          </p>
        </div>
        {canManageLeads && (
          <button
            type="button"
            onClick={clearAll}
            disabled={leads.length === 0}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Source</th>
                {canManageLeads && <th className="px-4 py-3 w-28 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-14 text-center text-sm text-gray-400">
                    No leads yet.
                  </td>
                </tr>
              ) : (
                leads.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{row.phone}</td>
                    <td className="px-4 py-3 text-gray-600">{row.source}</td>
                    {canManageLeads && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => remove(row.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                          aria-label={`Remove ${row.name}`}
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
    </div>
  )
}
