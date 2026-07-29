'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { ChevronDown, ChevronUp, Loader2, Save, RotateCcw, LayoutTemplate } from 'lucide-react'
import {
  saveSystemPromptAction,
  saveAgentNameAction,
  saveAgentSettingsAction,
  toggleAIAction,
  type ActionState,
} from '../actions'
import { useToast } from '@/components/toast'
import { usePermissions } from '@/hooks/usePermissions'
import TemplatePicker from './template-picker'
import type { IndustryTemplate } from '@/lib/types'
import { Card, buttonClasses, ConfirmDialog } from '@/components/ui'
// ── Constants ─────────────────────────────────────────────────────────────────

const readonlyBoxClass =
  'rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink whitespace-pre-wrap font-mono min-h-[120px]'

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
      className={buttonClasses()}
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
    <Card>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-0.5 mb-5 text-xs text-ink-2">{description}</p>}
      {!description && <div className="mb-5" />}
      {children}
    </Card>
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
        <p className="text-sm font-medium text-ink-2">{label}</p>
        {description && <p className="text-xs text-ink-3 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-surface shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
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
  initialAiEnabled,
}: {
  initialPrompt: string
  initialAgentName: string
  initialAutoLanguage: boolean
  initialUseEmoji: boolean
  initialSignOff: boolean
  initialResponseStyle: 'formal' | 'friendly' | 'casual'
  initialAiEnabled: boolean
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
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  useEffect(() => {
    if (promptState.success) toast.success('System prompt saved.')
    else if (promptState.error) toast.error(promptState.error)
  }, [promptState]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleApplyTemplate(template: IndustryTemplate) {
    setCurrentPrompt(template.system_prompt)
    toast.info(`Template applied. Edit it to match your business, then save.`)
  }

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

  // Section 4 — AI toggle
  const [aiToggleState, aiToggleAction] = useActionState(toggleAIAction, {} as ActionState)
  const [aiEnabled, setAiEnabled] = useState(initialAiEnabled)
  useEffect(() => {
    if (aiToggleState.success) toast.success(aiEnabled ? 'AI replies enabled.' : 'AI replies disabled.')
    else if (aiToggleState.error) toast.error(aiToggleState.error)
  }, [aiToggleState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Section 5 — Danger zone
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

      {templatePickerOpen && (
        <TemplatePicker
          onApply={handleApplyTemplate}
          onClose={() => setTemplatePickerOpen(false)}
        />
      )}

      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">My Agent</h1>
          <p className="mt-0.5 text-sm text-ink-2">
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
                <label htmlFor="agent_name" className="block text-sm font-medium text-ink-2 mb-1">
                  Agent name
                </label>
                <input
                  id="agent_name"
                  name="agent_name"
                  type="text"
                  defaultValue={initialAgentName}
                  placeholder="e.g. Sarah from Acme Support"
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                />
              </div>
              <div className="flex justify-end">
                <SaveButton label="Save name" />
              </div>
            </form>
          ) : (
            <div>
              <p className="text-xs font-medium text-ink-2 mb-1.5">Agent name</p>
              <div className={readonlyBoxClass}>{initialAgentName.trim() || '—'}</div>
            </div>
          )}
        </Section>

        {/* ── Section 2: System prompt ── */}
        <Section title="Personality &amp; system prompt">
          {canManageAgent ? (
            <form action={promptAction} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="system_prompt" className="block text-sm font-medium text-ink-2">
                    System prompt
                  </label>
                  <button
                    type="button"
                    onClick={() => setTemplatePickerOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
                  >
                    <LayoutTemplate size={11} strokeWidth={2} />
                    Browse templates
                  </button>
                </div>
                <textarea
                  id="system_prompt"
                  name="system_prompt"
                  rows={10}
                  value={currentPrompt}
                  onChange={(e) => setCurrentPrompt(e.target.value)}
                  className="w-full resize-y rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 font-mono"
                />
                <p className="mt-1.5 text-xs text-ink-3 leading-relaxed">
                  This tells your AI agent how to behave, what tone to use, and what topics to cover.
                  Be specific about your business.
                </p>
              </div>

              <div className="rounded-md border border-line bg-surface-2">
                <button
                  type="button"
                  onClick={() => setExampleOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-ink-2 hover:text-ink-2 transition-colors"
                >
                  See example
                  {exampleOpen ? (
                    <ChevronUp size={13} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={13} strokeWidth={2} />
                  )}
                </button>
                {exampleOpen && (
                  <div className="border-t border-line px-4 pb-4 pt-3">
                    <p className="text-xs text-ink-2 leading-relaxed font-mono whitespace-pre-wrap">
                      {EXAMPLE_PROMPT}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCurrentPrompt(EXAMPLE_PROMPT)}
                      className="mt-3 text-xs font-medium text-ink-2 hover:text-ink underline underline-offset-2 transition-colors"
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
              <p className="text-xs font-medium text-ink-2 mb-1.5">System prompt</p>
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
                <div className="divide-y divide-line/60">
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
                  <label htmlFor="response_style" className="block text-sm font-medium text-ink-2 mb-1">
                    Response style
                  </label>
                  <select
                    id="response_style"
                    value={responseStyle}
                    onChange={(e) => setResponseStyle(e.target.value as typeof responseStyle)}
                    className="rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 bg-surface"
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

            {/* ── Section 4: AI toggle ── */}
            <Section
              title="AI replies"
              description="Turn off AI to handle all incoming messages yourself."
            >
              <form
                action={(fd) => {
                  fd.set('ai_enabled', String(aiEnabled))
                  return aiToggleAction(fd)
                }}
                className="space-y-1"
              >
                <Toggle
                  label="AI replies enabled"
                  description="When off, incoming messages are saved to your inbox but the AI will not respond."
                  checked={aiEnabled}
                  onChange={setAiEnabled}
                />
                <div className="flex justify-end pt-2">
                  <SaveButton label="Save" />
                </div>
              </form>
            </Section>

            <section className="rounded-lg border border-danger/30 bg-surface p-6">
              <h3 className="text-sm font-semibold text-danger">Danger zone</h3>
              <p className="mt-0.5 mb-5 text-xs text-ink-2">
                These actions affect your agent's configuration.
              </p>
              <div className="flex items-center justify-between rounded-md border border-danger/30 bg-danger-soft/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-2">Reset to default prompt</p>
                  <p className="text-xs text-ink-3 mt-0.5">Replaces your current prompt with the generic default.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetDialog(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-surface px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-soft hover:border-danger/30 transition-colors"
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
