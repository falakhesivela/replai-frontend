'use client'

import { useState } from 'react'
import { Table2, ChartLine } from 'lucide-react'
import { Card } from '@/components/ui'

export interface ChartTableColumn {
  key: string
  label: string
}

interface ChartCardProps {
  title: string
  /** Small print under the title (e.g. the active range). */
  caption?: string
  /** Table view of the plotted data — the accessibility/contrast relief. */
  table?: {
    columns: ChartTableColumn[]
    rows: Array<Record<string, React.ReactNode>>
  }
  /** Right-aligned header extras. */
  actions?: React.ReactNode
  children: React.ReactNode
}

/** Card chrome for every chart: title row, optional "view as table" toggle. */
export function ChartCard({ title, caption, table, actions, children }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false)

  return (
    <Card padding="sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {caption && <p className="mt-0.5 text-xs text-ink-3">{caption}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              title={showTable ? 'View as chart' : 'View as table'}
              aria-label={showTable ? 'View as chart' : 'View as table'}
            >
              {showTable ? (
                <ChartLine size={14} strokeWidth={1.75} />
              ) : (
                <Table2 size={14} strokeWidth={1.75} />
              )}
            </button>
          )}
        </div>
      </div>

      {showTable && table ? (
        <div className="max-h-64 overflow-y-auto overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-2">
              <tr className="text-left text-ink-3">
                {table.columns.map((c) => (
                  <th key={c.key} className="px-3 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {table.columns.map((c) => (
                    <td key={c.key} className="px-3 py-1.5 font-mono tabular-nums text-ink-2">
                      {row[c.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  )
}
