'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ChevronDown, ChevronUp, Loader2, Save, RotateCcw, X } from 'lucide-react'
import {
  saveSystemPromptAction,
  saveAgentNameAction,
  saveAgentSettingsAction,
  type ActionState,
} from '../actions'
import { useToast } from '@/components/toast'
import { usePermissions } from '@/hooks/usePermissions'

// ── Constants ─────────────────────────────────────────────────────────────────

const readonlyBoxClass =
  'rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap font-mono min-h-[120px]'

const DEFAULT_PROMPT =
  `You are a helpful customer support assistant. Be friendly, concise, and professional. ` +
  `Only answer questions related to our products and services. ` +
  `If you cannot help, politely ask the customer to contact our support team.`

const EXAMPLE_PROMPT =
  `You are Sarah, a friendly support assistant for Acme Supplies. ` +
  `Your tone is warm but professional. You help customers with order tracking, ` +
  `product questions, and returns. Always greet customers by name if they provide it. ` +
  `If a question is outside your scope, say: "I'll connect you with our team right away." ` +
  `Keep responses under 3 sentences unless more detail is clearly needed.`

// ── Shared save button ────────────────────────────────────────────────────────

function SaveButton({ label = 'Save changes' }: { label?: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-[#1E0B6F] px-3 py-2 text-sm font-medium text-white hover:bg-[#2d1499] focus:outline-none focus:ring-2 focus:ring-[#3D6BF8] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={2} />}
      {pending ? 'Saving…' : label}
    </button>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-0.5 mb-5 text-xs text-gray-500">{description}</p>}
      {!description && <div className="mb-5" />}
      {children}
    </section>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#3D6BF8] focus:ring-offset-2 ${
          checked ? 'bg-[#1E0B6F]' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

// ── Confirmation dialog ───────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} strokeWidth={2} />
        </button>
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <p className="mt-1.5 text-sm text-gray-500">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main form component ───────────────────────────────────────────────────────

export default function AgentForm({
  initialPrompt,
  initialAgentName,
  initialAutoLanguage,
  initialUseEmoji,
  initialSignOff,
  initialResponseStyle,
}: {
  initialPrompt: string
  initialAgentName: string
  initialAutoLanguage: boolean
  initialUseEmoji: boolean
  initialSignOff: boolean
  initialResponseStyle: 'formal' | 'friendly' | 'casual'
}) {
  const { toast } = useToast()
  const { can } = usePermissions()
  const canManageAgent = can('manage_agent')

  // Section 1 — Agent identity
  const [nameState, nameAction] = useActionState(saveAgentNameAction, {} as ActionState)
  useEffect(() => {
    if (nameState.success) toast.success('Agent name saved.')
    else if (nameState.error) toast.error(nameState.error)
  }, [nameState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Section 2 — System prompt
  const [promptState, promptAction] = useActionState(saveSystemPromptAction, {} as ActionState)
  const [currentPrompt, setCurrentPrompt] = useState(initialPrompt)
  const [exampleOpen, setExampleOpen] = useState(false)
  useEffect(() => {
    if (promptState.success) toast.success('System prompt saved.')
    else if (promptState.error) toast.error(promptState.error)
  }, [promptState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Section 3 — Behaviour settings
  const [settingsState, settingsAction] = useActionState(saveAgentSettingsAction, {} as ActionState)
  const [autoLanguage, setAutoLanguage] = useState(initialAutoLanguage)
  const [useEmoji, setUseEmoji] = useState(initialUseEmoji)
  const [signOff, setSignOff] = useState(initialSignOff)
  const [responseStyle, setResponseStyle] = useState<'formal' | 'friendly' | 'casual'>(initialResponseStyle)
  useEffect(() => {
    if (settingsState.success) toast.success('Behaviour settings saved.')
    else if (settingsState.error) toast.error(settingsState.error)
  }, [settingsState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Section 4 — Danger zone
  const [showResetDialog, setShowResetDialog] = useState(false)

  function handleReset() {
    setCurrentPrompt(DEFAULT_PROMPT)
    setShowResetDialog(false)
    toast.info('Prompt reset. Save to apply.')
  }

  return (
    <>
      {showResetDialog && (
        <ConfirmDialog
          title="Reset to default prompt?"
          description="This will replace your current system prompt with the default. You'll need to save to apply the change."
          confirmLabel="Reset prompt"
          onConfirm={handleReset}
          onCancel={() => setShowResetDialog(false)}
        />
      )}

      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">My Agent</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {canManageAgent
              ? "Configure your AI assistant's identity and behaviour."
              : 'View-only: only owners and managers can change agent configuration.'}
          </p>
        </div>

        {/* ── Section 1: Agent identity ── */}
        <Section
          title="Agent identity"
          description="Give your agent a name that will appear to customers."
        >
          {canManageAgent ? (
            <form action={nameAction} className="space-y-4">
              <div>
                <label htmlFor="agent_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Agent name
                </label>
                <input
                  id="agent_name"
                  name="agent_name"
                  type="text"
                  defaultValue={initialAgentName}
                  placeholder="e.g. Sarah from Acme Support"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3D6BF8] focus:outline-none focus:ring-1 focus:ring-[#3D6BF8]"
                />
              </div>
              <div className="flex justify-end">
                <SaveButton label="Save name" />
              </div>
            </form>
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Agent name</p>
              <div className={readonlyBoxClass}>{initialAgentName.trim() || '—'}</div>
            </div>
          )}
        </Section>

        {/* ── Section 2: System prompt ── */}
        <Section title="Personality &amp; system prompt">
          {canManageAgent ? (
            <form action={promptAction} className="space-y-4">
              <div>
                <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700 mb-1">
                  System prompt
                </label>
                <textarea
                  id="system_prompt"
                  name="system_prompt"
                  rows={10}
                  value={currentPrompt}
                  onChange={(e) => setCurrentPrompt(e.target.value)}
                  className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3D6BF8] focus:outline-none focus:ring-1 focus:ring-[#3D6BF8] font-mono"
                />
                <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
                  This tells your AI agent how to behave, what tone to use, and what topics to cover.
                  Be specific about your business.
                </p>
              </div>

              <div className="rounded-md border border-gray-100 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setExampleOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  See example
                  {exampleOpen ? (
                    <ChevronUp size={13} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={13} strokeWidth={2} />
                  )}
                </button>
                {exampleOpen && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    <p className="text-xs text-gray-500 leading-relaxed font-mono whitespace-pre-wrap">
                      {EXAMPLE_PROMPT}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCurrentPrompt(EXAMPLE_PROMPT)}
                      className="mt-3 text-xs font-medium text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors"
                    >
                      Use this as a starting point
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <SaveButton />
              </div>
            </form>
          ) : (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">System prompt</p>
              <div className={readonlyBoxClass}>{currentPrompt.trim() || '—'}</div>
            </div>
          )}
        </Section>

        {canManageAgent && (
          <>
            {/* ── Section 3: Behaviour settings ── */}
            <Section
              title="Behaviour settings"
              description="Fine-tune how your agent responds on WhatsApp."
            >
              <form
                action={(fd) => {
                  fd.set('auto_language', String(autoLanguage))
                  fd.set('use_emoji', String(useEmoji))
                  fd.set('sign_off', String(signOff))
                  fd.set('response_style', responseStyle)
                  return settingsAction(fd)
                }}
                className="space-y-1"
              >
                <div className="divide-y divide-gray-50">
                  <Toggle
                    label="Reply in customer's language automatically"
                    description="Detects the customer's language and responds in kind."
                    checked={autoLanguage}
                    onChange={setAutoLanguage}
                  />
                  <Toggle
                    label="Add emoji to responses"
                    description="Makes responses feel warmer and more approachable."
                    checked={useEmoji}
                    onChange={setUseEmoji}
                  />
                  <Toggle
                    label="Sign off messages with agent name"
                    description={`Appends "— ${initialAgentName || 'Your Agent'}" to each reply.`}
                    checked={signOff}
                    onChange={setSignOff}
                  />
                </div>

                <div className="mt-5">
                  <label htmlFor="response_style" className="block text-sm font-medium text-gray-700 mb-1">
                    Response style
                  </label>
                  <select
                    id="response_style"
                    value={responseStyle}
                    onChange={(e) => setResponseStyle(e.target.value as typeof responseStyle)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[#3D6BF8] focus:outline-none focus:ring-1 focus:ring-[#3D6BF8] bg-white"
                  >
                    <option value="formal">Formal</option>
                    <option value="friendly">Friendly</option>
                    <option value="casual">Casual</option>
                  </select>
                </div>

                <div className="flex justify-end pt-4">
                  <SaveButton label="Save settings" />
                </div>
              </form>
            </Section>

            <section className="rounded-lg border border-red-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
              <p className="mt-0.5 mb-5 text-xs text-gray-500">
                These actions affect your agent's configuration.
              </p>
              <div className="flex items-center justify-between rounded-md border border-red-100 bg-red-50/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Reset to default prompt</p>
                  <p className="text-xs text-gray-400 mt-0.5">Replaces your current prompt with the generic default.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetDialog(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                >
                  <RotateCcw size={13} strokeWidth={2} />
                  Reset
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  )
}
