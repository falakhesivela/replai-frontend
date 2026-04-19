'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Megaphone,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  cancelMyBroadcast,
  createMyBroadcast,
  deleteMyBroadcast,
  getMyBroadcastAudiencePreview,
  getMyBroadcasts,
  PortalAuthError,
  sendMyBroadcast,
  validateBroadcastMessage,
  type BroadcastValidationResult,
  type TokenGetter,
} from '@/lib/api'
import type { Broadcast, BroadcastAudience, BroadcastStatus } from '@/lib/types'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'all' | 'draft' | 'scheduled' | 'sent'
type WizardStep = 1 | 2 | 3 | 4

interface WizardState {
  step: WizardStep
  name: string
  message: string
  targetAudience: BroadcastAudience
  scheduleType: 'immediate' | 'scheduled'
  scheduledAt: string
  confirmed: boolean
}

const EMPTY_WIZARD: WizardState = {
  step: 1,
  name: '',
  message: '',
  targetAudience: 'all',
  scheduleType: 'immediate',
  scheduledAt: '',
  confirmed: false,
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
  all: 'All contacts',
  leads: 'Leads only',
  bookings: 'Confirmed bookings',
  active_conversations: 'Active conversations',
}

const AUDIENCE_BADGE_STYLES: Record<BroadcastAudience, string> = {
  all: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  leads: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  bookings: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  active_conversations: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
}

const AUDIENCE_BADGE_LABELS: Record<BroadcastAudience, string> = {
  all: 'All',
  leads: 'Leads',
  bookings: 'Bookings',
  active_conversations: 'Active',
}

const STATUS_BADGE_STYLES: Record<BroadcastStatus, string> = {
  draft: 'bg-gray-100 text-gray-500',
  scheduled: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  sending: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  sent: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  failed: 'bg-red-50 text-red-600 ring-1 ring-red-200',
}

const STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending…',
  sent: 'Sent',
  failed: 'Failed',
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'sent', label: 'Sent' },
]

const WA_MAX_CHARS = 4096

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatScheduled(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function deliveryRate(b: Broadcast): string {
  if (b.status !== 'sent' && b.status !== 'sending') return '—'
  if (!b.total_recipients) return '—'
  return `${Math.round((b.sent_count / b.total_recipients) * 100)}%`
}

function previewMessage(message: string, businessName = 'Your Business'): string {
  return message.replace('{name}', 'Alex').replace('{business}', businessName)
}

// ── Badge components ──────────────────────────────────────────────────────────

function AudienceBadge({ audience }: { audience: BroadcastAudience }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${AUDIENCE_BADGE_STYLES[audience]}`}>
      {AUDIENCE_BADGE_LABELS[audience]}
    </span>
  )
}

function StatusBadge({ status }: { status: BroadcastStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_STYLES[status]}`}>
      {status === 'sending' && <span className="h-1.5 w-1.5 rounded-full bg-[#3D6BF8] animate-pulse" />}
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── Toast (minimal inline) ────────────────────────────────────────────────────

function useToast() {
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function toast(text: string, type: 'success' | 'error' = 'success') {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMessage({ text, type })
    timerRef.current = setTimeout(() => setMessage(null), 4000)
  }

  return { message, toast }
}

// ── Wizard ────────────────────────────────────────────────────────────────────

function BroadcastWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (b: Broadcast) => void
}) {
  const [state, setState] = useState<WizardState>(EMPTY_WIZARD)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audienceCounts, setAudienceCounts] = useState<Partial<Record<BroadcastAudience, number>>>({})
  const [loadingCounts, setLoadingCounts] = useState(false)
  const [validation, setValidation] = useState<BroadcastValidationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch count for the selected audience whenever user reaches step 2
  useEffect(() => {
    if (state.step !== 2) return
    const aud = state.targetAudience
    if (audienceCounts[aud] !== undefined) return

    setLoadingCounts(true)
    getMyBroadcastAudiencePreview(getFreshToken, aud)
      .then(({ count }) => setAudienceCounts((prev) => ({ ...prev, [aud]: count })))
      .catch(() => {/* non-fatal */})
      .finally(() => setLoadingCounts(false))
  }, [state.step, state.targetAudience, audienceCounts])

  // Debounced live validation on step 1
  useEffect(() => {
    if (state.step !== 1) return
    if (validationTimerRef.current) clearTimeout(validationTimerRef.current)
    if (!state.message) {
      setValidation(null)
      return
    }
    validationTimerRef.current = setTimeout(async () => {
      setValidating(true)
      try {
        const result = await validateBroadcastMessage(getFreshToken, state.message)
        setValidation(result)
      } catch {
        /* non-fatal — skip showing validation */
      } finally {
        setValidating(false)
      }
    }, 500)
    return () => {
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current)
    }
  }, [state.message, state.step])

  // Also pre-fetch when audience radio changes on step 2
  function selectAudience(aud: BroadcastAudience) {
    setState((s) => ({ ...s, targetAudience: aud }))
    if (audienceCounts[aud] !== undefined) return
    setLoadingCounts(true)
    getMyBroadcastAudiencePreview(getFreshToken, aud)
      .then(({ count }) => setAudienceCounts((prev) => ({ ...prev, [aud]: count })))
      .catch(() => {/* non-fatal */})
      .finally(() => setLoadingCounts(false))
  }

  function set<K extends keyof WizardState>(key: K, val: WizardState[K]) {
    setState((s) => ({ ...s, [key]: val }))
  }

  function nextStep() {
    setState((s) => ({ ...s, step: (s.step + 1) as WizardStep }))
    setError(null)
  }

  function prevStep() {
    setState((s) => ({ ...s, step: (s.step - 1) as WizardStep }))
    setError(null)
  }

  async function submit() {
    if (!state.confirmed) return
    setSubmitting(true)
    setError(null)
    try {
      const scheduled_at =
        state.scheduleType === 'scheduled' && state.scheduledAt
          ? new Date(state.scheduledAt).toISOString()
          : null
      const created = await createMyBroadcast(getFreshToken, {
        name: state.name,
        message: state.message,
        target_audience: state.targetAudience,
        scheduled_at,
      })

      // For immediate sends, trigger the send right away so the user never
      // has to manually press "Send now" from the table.
      if (state.scheduleType === 'immediate') {
        await sendMyBroadcast(getFreshToken, created.id)
        onCreated({ ...created, status: 'sending' })
      } else {
        onCreated(created)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const recipientCount = audienceCounts[state.targetAudience]

  // Step labels
  const STEP_LABELS = ['Compose', 'Audience', 'Schedule', 'Confirm']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">New Broadcast</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {state.step} of 4 — {STEP_LABELS[state.step - 1]}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-[#1E0B6F] transition-all duration-300"
            style={{ width: `${(state.step / 4) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Step 1: Compose */}
          {state.step === 1 && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Broadcast name <span className="text-gray-400">(internal reference)</span>
                </label>
                <input
                  type="text"
                  value={state.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. April promotion"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-700">Message</label>
                  <span className={`text-[11px] ${state.message.length > WA_MAX_CHARS ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                    {state.message.length} / {WA_MAX_CHARS}
                  </span>
                </div>
                <textarea
                  value={state.message}
                  onChange={(e) => set('message', e.target.value)}
                  rows={5}
                  placeholder="Hi {name}, we have an exciting offer for you…"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none resize-none"
                />
                <div className="mt-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-gray-400">Insert variable:</span>
                    {['{name}', '{full_name}', '{business}', '{date}', '{time}'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set('message', state.message + v)}
                        className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-mono text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Validation feedback */}
                {state.message && (
                  <div className="mt-2 space-y-1">
                    {validating && (
                      <p className="flex items-center gap-1 text-[11px] text-gray-400">
                        <Loader2 size={11} className="animate-spin" /> Checking…
                      </p>
                    )}
                    {!validating && validation && validation.warnings.map((w, i) => {
                      const isError = w.startsWith('Message is empty') || w.startsWith('Message exceeds')
                      const isSuggestion = w.startsWith('No personalisation')
                      return (
                        <p
                          key={i}
                          className={`text-[11px] ${
                            isError ? 'text-red-500' : isSuggestion ? 'text-gray-400' : 'text-amber-600'
                          }`}
                        >
                          {isError ? '✕ ' : isSuggestion ? '○ ' : '⚠ '}{w}
                        </p>
                      )
                    })}
                  </div>
                )}
              </div>

              {state.message && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Preview</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{previewMessage(state.message)}</p>
                </div>
              )}
            </>
          )}

          {/* Step 2: Audience */}
          {state.step === 2 && (
            <fieldset className="space-y-2.5">
              <legend className="text-xs font-medium text-gray-700 mb-3">Select target audience</legend>
              {(Object.entries(AUDIENCE_LABELS) as [BroadcastAudience, string][]).map(([aud, label]) => {
                const count = audienceCounts[aud]
                return (
                  <label
                    key={aud}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                      state.targetAudience === aud
                        ? 'border-[#3D6BF8] bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      value={aud}
                      checked={state.targetAudience === aud}
                      onChange={() => selectAudience(aud)}
                      className="accent-gray-900"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                    </div>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {state.targetAudience === aud && loadingCounts ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : count !== undefined ? (
                        `${count} contacts`
                      ) : (
                        ''
                      )}
                    </span>
                  </label>
                )
              })}
            </fieldset>
          )}

          {/* Step 3: Schedule */}
          {state.step === 3 && (
            <fieldset className="space-y-2.5">
              <legend className="text-xs font-medium text-gray-700 mb-3">When to send</legend>

              <label className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                state.scheduleType === 'immediate' ? 'border-[#3D6BF8] bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="schedule"
                  value="immediate"
                  checked={state.scheduleType === 'immediate'}
                  onChange={() => set('scheduleType', 'immediate')}
                  className="accent-gray-900"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Send immediately</p>
                  <p className="text-xs text-gray-400">Broadcast starts as soon as you confirm</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                state.scheduleType === 'scheduled' ? 'border-[#3D6BF8] bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="schedule"
                  value="scheduled"
                  checked={state.scheduleType === 'scheduled'}
                  onChange={() => set('scheduleType', 'scheduled')}
                  className="accent-gray-900 mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Schedule for later</p>
                  {state.scheduleType === 'scheduled' && (
                    <div className="mt-2">
                      <input
                        type="datetime-local"
                        value={state.scheduledAt}
                        onChange={(e) => set('scheduledAt', e.target.value)}
                        min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Timezone: Africa/Johannesburg</p>
                    </div>
                  )}
                </div>
              </label>
            </fieldset>
          )}

          {/* Step 4: Confirm */}
          {state.step === 4 && (
            <>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium text-gray-900 truncate ml-4 max-w-[60%] text-right">{state.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Audience</span>
                  <AudienceBadge audience={state.targetAudience} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Recipients</span>
                  <span className="font-medium text-gray-900 tabular-nums">
                    {recipientCount !== undefined ? `${recipientCount} contacts` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sending</span>
                  <span className="font-medium text-gray-900">
                    {state.scheduleType === 'immediate'
                      ? 'Immediately'
                      : state.scheduledAt
                      ? new Date(state.scheduledAt).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })
                      : '—'}
                  </span>
                </div>
              </div>

              {recipientCount !== undefined && recipientCount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-800">
                    This will send to <strong>{recipientCount} contacts</strong>. This cannot be undone.
                  </p>
                </div>
              )}

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.confirmed}
                  onChange={(e) => set('confirmed', e.target.checked)}
                  className="accent-gray-900 h-4 w-4"
                />
                <span className="text-sm text-gray-700">I understand and want to proceed</span>
              </label>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={state.step === 1 ? onClose : prevStep}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            {state.step > 1 && <ChevronLeft size={15} />}
            {state.step === 1 ? 'Cancel' : 'Back'}
          </button>

          {state.step < 4 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={
                (state.step === 1 && (
                  !state.name.trim() ||
                  !state.message.trim() ||
                  (validation != null && !validation.valid)
                )) ||
                (state.step === 3 && state.scheduleType === 'scheduled' && !state.scheduledAt)
              }
              className="flex items-center gap-1.5 rounded-lg bg-[#1E0B6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d1499] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continue
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!state.confirmed || submitting}
              className="flex items-center gap-1.5 rounded-lg bg-[#1E0B6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d1499] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {state.scheduleType === 'scheduled' ? 'Schedule' : 'Send now'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BroadcastsView({ initialBroadcasts }: { initialBroadcasts: Broadcast[] }) {
  const router = useRouter()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>(initialBroadcasts)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [showWizard, setShowWizard] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const { message: toastMsg, toast } = useToast()

  async function refresh() {
    try {
      const list = await getMyBroadcasts(getFreshToken)
      setBroadcasts(list)
    } catch (e) {
      if (e instanceof PortalAuthError) router.replace('/portal/login')
    }
  }

  // Poll every 3 seconds while any broadcast is actively sending.
  useEffect(() => {
    const hasSending = broadcasts.some((b) => b.status === 'sending')
    if (!hasSending) return
    const id = setInterval(() => { void refresh() }, 3000)
    return () => clearInterval(id)
  }, [broadcasts])

  // ── Tab filter ──────────────────────────────────────────────────────────────
  const filtered = broadcasts.filter((b) => {
    if (activeTab === 'all') return true
    if (activeTab === 'sent') return b.status === 'sent' || b.status === 'sending'
    return b.status === activeTab
  })

  // ── Stats ───────────────────────────────────────────────────────────────────
  const sentBroadcasts = broadcasts.filter((b) => b.status === 'sent')
  const totalSent = sentBroadcasts.reduce((s, b) => s + b.sent_count, 0)
  const totalRecipients = sentBroadcasts.reduce((s, b) => s + b.total_recipients, 0)
  const avgRate = sentBroadcasts.length
    ? Math.round(
        sentBroadcasts.reduce((s, b) => s + (b.total_recipients ? b.sent_count / b.total_recipients : 0), 0) /
          sentBroadcasts.length * 100
      )
    : 0

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleSendNow(id: string) {
    setBusy((p) => ({ ...p, [id]: true }))
    try {
      await sendMyBroadcast(getFreshToken, id)
      toast('Broadcast is sending', 'success')
      await refresh()
    } catch {
      toast('Failed to start broadcast', 'error')
    } finally {
      setBusy((p) => ({ ...p, [id]: false }))
    }
  }

  async function handleCancel(id: string) {
    setBusy((p) => ({ ...p, [id]: true }))
    try {
      const updated = await cancelMyBroadcast(getFreshToken, id)
      setBroadcasts((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)))
      toast('Broadcast cancelled', 'success')
    } catch {
      toast('Failed to cancel broadcast', 'error')
    } finally {
      setBusy((p) => ({ ...p, [id]: false }))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this draft broadcast?')) return
    setBusy((p) => ({ ...p, [id]: true }))
    try {
      await deleteMyBroadcast(getFreshToken, id)
      setBroadcasts((prev) => prev.filter((b) => b.id !== id))
      toast('Broadcast deleted', 'success')
    } catch {
      toast('Failed to delete broadcast', 'error')
    } finally {
      setBusy((p) => ({ ...p, [id]: false }))
    }
  }

  function handleCreated(b: Broadcast) {
    setBroadcasts((prev) => [b, ...prev])
    setShowWizard(false)
    if (b.status === 'sending') {
      toast('Broadcast is sending', 'success')
      router.push(`/portal/broadcasts/${b.id}`)
    } else {
      toast('Broadcast scheduled', 'success')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-2.5 text-sm font-medium shadow-md transition-all ${
          toastMsg.type === 'success'
            ? 'bg-[#1E0B6F] text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toastMsg.text}
        </div>
      )}

      {/* Wizard */}
      {showWizard && (
        <BroadcastWizard
          onClose={() => setShowWizard(false)}
          onCreated={handleCreated}
        />
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-lg font-semibold text-gray-900">Broadcasts</h1>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#1E0B6F] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#2d1499] transition-colors"
          >
            <Plus size={15} />
            Create broadcast
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total sent', value: totalSent.toLocaleString() },
            { label: 'Total recipients', value: totalRecipients.toLocaleString() },
            { label: 'Avg delivery rate', value: sentBroadcasts.length ? `${avgRate}%` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-gray-100 bg-white px-5 py-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4 gap-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === id
                  ? 'border-[#3D6BF8] text-[#1E0B6F]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {id !== 'all' && (
                <span className="ml-1.5 tabular-nums text-[11px] text-gray-400">
                  ({broadcasts.filter((b) => {
                    if (id === 'sent') return b.status === 'sent' || b.status === 'sending'
                    return b.status === id
                  }).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Megaphone size={32} strokeWidth={1.5} className="text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No broadcasts yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first broadcast to reach your customers</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-100 bg-white overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Recipients</th>
                  <th className="px-4 py-3 text-right">Delivery</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((b) => {
                  const isLoading = !!busy[b.id]
                  return (
                    <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{b.name}</td>
                      <td className="px-4 py-3"><AudienceBadge audience={b.target_audience} /></td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                        {b.total_recipients || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                        {deliveryRate(b)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {b.status === 'scheduled'
                          ? formatScheduled(b.scheduled_at)
                          : b.status === 'sent'
                          ? formatRelativeTime(b.sent_at)
                          : formatRelativeTime(b.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {isLoading ? (
                            <Loader2 size={14} className="animate-spin text-gray-400" />
                          ) : (
                            <>
                              {/* Draft actions */}
                              {b.status === 'draft' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSendNow(b.id)}
                                    title="Send now"
                                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                  >
                                    <Send size={13} strokeWidth={1.75} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(b.id)}
                                    title="Delete"
                                    className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 size={13} strokeWidth={1.75} />
                                  </button>
                                </>
                              )}

                              {/* Scheduled actions */}
                              {b.status === 'scheduled' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/portal/broadcasts/${b.id}`)}
                                    title="View"
                                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                  >
                                    <Eye size={13} strokeWidth={1.75} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancel(b.id)}
                                    title="Cancel"
                                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                  >
                                    <X size={13} strokeWidth={1.75} />
                                  </button>
                                </>
                              )}

                              {/* Sent / Sending actions */}
                              {(b.status === 'sent' || b.status === 'sending') && (
                                <button
                                  type="button"
                                  onClick={() => router.push(`/portal/broadcasts/${b.id}`)}
                                  title="View stats"
                                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                >
                                  View stats
                                  <ArrowRight size={11} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
