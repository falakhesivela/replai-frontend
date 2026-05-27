'use client'

import { useState } from 'react'
import { X, CheckCircle2, ArrowRight } from 'lucide-react'
import { INDUSTRY_TEMPLATES } from '@/lib/templates'
import type { IndustryTemplate } from '@/lib/types'

export default function TemplatePicker({
  onApply,
  onClose,
}: {
  onApply: (template: IndustryTemplate) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<IndustryTemplate | null>(null)

  function handleApply() {
    if (selected) {
      onApply(selected)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex w-full max-w-4xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Industry templates</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Pick a starting point and customise it to match your business.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {/* Template grid */}
          <div className="w-80 shrink-0 overflow-y-auto border-r border-gray-100 p-4 space-y-2">
            {INDUSTRY_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                  selected?.id === t.id
                    ? 'border-accent bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none mt-0.5 shrink-0">{t.emoji}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${selected?.id === t.id ? 'text-brand' : 'text-gray-900'}`}>
                      {t.name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 leading-snug">{t.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {t.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {selected?.id === t.id && (
                    <CheckCircle2 size={14} className="shrink-0 text-accent mt-0.5 ml-auto" strokeWidth={2} />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Preview pane */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{selected.emoji}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{selected.name}</h3>
                      {selected.suggested_agent_name && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Suggested agent name: <span className="font-medium text-gray-600">{selected.suggested_agent_name}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {selected.features.length > 0 && (
                    <div className="mb-4 rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
                      <p className="text-xs font-medium text-blue-700 mb-1">Works best with</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.features.map((f) => (
                          <span
                            key={f}
                            className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 capitalize"
                          >
                            {f === 'ecommerce' ? 'E-commerce' : 'Bookings'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">System prompt preview</p>
                    <pre className="whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700 leading-relaxed font-mono">
                      {selected.system_prompt}
                    </pre>
                  </div>
                </div>

                <div className="shrink-0 border-t border-gray-100 px-6 py-4 bg-white flex items-center justify-between gap-4">
                  <p className="text-xs text-gray-400">
                    This will replace your current system prompt. You can edit it after applying.
                  </p>
                  <button
                    onClick={handleApply}
                    className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors shrink-0"
                  >
                    Apply template
                    <ArrowRight size={13} strokeWidth={2} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
                <p className="text-2xl mb-3">👈</p>
                <p className="text-sm font-medium text-gray-700">Select a template to preview</p>
                <p className="mt-1 text-xs text-gray-400 max-w-xs">
                  Choose an industry from the left to see the system prompt and apply it to your agent.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
