'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Mail,
  Phone,
  KeyRound,
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  Eye,
  EyeOff,
  Clock,
  ChevronRight,
  ChevronDown,
  Info,
} from 'lucide-react'
import { changePasswordAction, updateCredentialsAction, saveNotificationPrefsAction, type PasswordState, type CredentialsState } from '../actions'
import { useToast } from '@/components/toast'
import { usePermissions } from '@/hooks/usePermissions'
import type { Client } from '@/lib/types'
import { Card, buttonClasses } from '@/components/ui'
import WhatsAppEmbeddedSignup, {
  whatsappEmbeddedSignupConfigured,
} from '@/components/whatsapp-embedded-signup'
// ── Shared primitives ─────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25'

const readonlyClass =
  'flex items-center gap-2.5 rounded-md border border-line bg-surface-2 px-3 py-2'

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-2 mb-1">
      {children}
    </label>
  )
}

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
        {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
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

// ── Password field with show/hide ─────────────────────────────────────────────

function PasswordInput({
  id,
  name,
  placeholder,
  autoComplete,
  required,
  minLength,
}: {
  id: string
  name: string
  placeholder?: string
  autoComplete?: string
  required?: boolean
  minLength?: number
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className={inputClass + ' pr-10'}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
      </button>
    </div>
  )
}

// ── Change password section ───────────────────────────────────────────────────

function PasswordSaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClasses()}
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} strokeWidth={2} />}
      {pending ? 'Updating…' : 'Update password'}
    </button>
  )
}

function ChangePasswordSection() {
  const { toast } = useToast()
  const [state, action] = useActionState(changePasswordAction, {} as PasswordState)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (state.success) {
      toast.success('Password updated.')
      setFormKey((k) => k + 1)
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold text-ink">Change password</h3>
      <p className="mb-5 text-xs text-ink-2">Choose a strong password at least 8 characters long.</p>

      <form key={formKey} action={action} className="space-y-4">
        <div>
          <FieldLabel htmlFor="current_password">Current password</FieldLabel>
          <PasswordInput
            id="current_password"
            name="current_password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <div>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <PasswordInput
            id="password"
            name="password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        <div>
          <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
          <PasswordInput
            id="confirm"
            name="confirm"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        {state.fieldError && (
          <p className="text-xs text-danger">{state.fieldError}</p>
        )}

        <div className="flex justify-end pt-1">
          <PasswordSaveButton />
        </div>
      </form>
    </Card>
  )
}

// ── WhatsApp credentials modal ────────────────────────────────────────────────

function CredentialsSaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClasses()}
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : null}
      {pending ? 'Saving…' : 'Save credentials'}
    </button>
  )
}

function UpdateCredentialsModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast()
  const [state, action] = useActionState(updateCredentialsAction, {} as CredentialsState)

  useEffect(() => {
    if (state.success) {
      toast.success('Credentials updated.')
      onClose()
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-line bg-surface shadow-card p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-0.5 text-ink-3 hover:text-ink-2 transition-colors"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <h4 className="text-sm font-semibold text-ink">Update WhatsApp credentials</h4>
        <p className="mt-1 mb-5 text-xs text-ink-2">
          Paste your new Phone Number ID and access token from the Meta developer portal.
        </p>

        <form action={action} className="space-y-4">
          <div>
            <FieldLabel htmlFor="wa_phone_number_id">Phone Number ID</FieldLabel>
            <input
              id="wa_phone_number_id"
              name="wa_phone_number_id"
              type="text"
              required
              placeholder="e.g. 123456789012345"
              className={inputClass}
            />
          </div>

          <div>
            <FieldLabel htmlFor="wa_access_token">Access token</FieldLabel>
            <textarea
              id="wa_access_token"
              name="wa_access_token"
              required
              rows={4}
              placeholder="Paste your access token here…"
              className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 font-mono text-xs"
            />
            <p className="mt-1 text-xs text-ink-3">
              Find this in Meta for Developers → WhatsApp → API Setup.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <CredentialsSaveButton />
          </div>
        </form>
      </div>
    </div>
  )
}

// ── WhatsApp section ──────────────────────────────────────────────────────────

function maskPhoneNumberId(id: string): string {
  if (!id || id.length <= 8) return id
  const visible = 4
  return `${id.slice(0, visible)}${'•'.repeat(Math.min(id.length - visible * 2, 8))}${id.slice(-visible)}`
}

function WhatsAppSection({ client }: { client: Client }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const isConnected = !!client.wa_access_token

  return (
    <>
      {modalOpen && <UpdateCredentialsModal onClose={() => setModalOpen(false)} />}

      <Card>
        <div className="flex items-start justify-between mb-5 gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">WhatsApp connection</h3>
            <p className="mt-0.5 text-xs text-ink-2">
              Your connected WhatsApp Business number.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {whatsappEmbeddedSignupConfigured ? (
              <>
                <WhatsAppEmbeddedSignup
                  variant="primary"
                  label={isConnected ? 'Reconnect WhatsApp' : 'Connect with WhatsApp'}
                  onConnected={(status) => {
                    if (status.registration_warning) {
                      toast.error(status.registration_warning)
                    } else {
                      toast.success('WhatsApp connected.')
                    }
                    router.refresh()
                  }}
                  onError={(message) => toast.error(message)}
                  onCancel={() => setHelpOpen(true)}
                />
                <button
                  onClick={() => setModalOpen(true)}
                  className="text-xs font-medium text-ink-3 hover:text-ink-2 transition-colors"
                >
                  Enter credentials manually
                </button>
              </>
            ) : (
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-2 transition-colors"
              >
                Update credentials
              </button>
            )}
          </div>
        </div>

        {whatsappEmbeddedSignupConfigured && (
          <div className="mb-5 rounded-md border border-line bg-surface-2/60">
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
              <Info size={14} strokeWidth={2} className="shrink-0 text-ink-3" />
              <span className="text-xs font-medium text-ink-2">
                Already use this number in the WhatsApp Business app?
              </span>
              <ChevronDown
                size={14}
                strokeWidth={2}
                className={`ml-auto shrink-0 text-ink-3 transition-transform ${
                  helpOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {helpOpen && (
              <div className="space-y-2 border-t border-line px-3 py-2.5 text-xs leading-relaxed text-ink-2">
                <p>
                  You can keep using the WhatsApp Business <strong>app</strong> on the same
                  number while Replai connects via the API (Meta calls this coexistence).
                  During Connect, choose the option to link your existing WhatsApp Business
                  account and follow the in-app verification prompts.
                </p>
                <p>
                  Keep the WhatsApp Business app open for a few minutes after connecting so
                  Meta can finish syncing. You need app version 2.24.17 or newer.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-ink-2 mb-1.5">Connected number</p>
            <div className={readonlyClass}>
              <Phone size={14} strokeWidth={1.75} className="shrink-0 text-ink-3" />
              <span className="text-sm text-ink-2">
                {client.wa_phone_number || '—'}
              </span>
            </div>
            {isConnected && client.wa_coexistence && (
              <p className="mt-1.5 text-xs text-ink-3">
                Coexistence mode — you can keep using the WhatsApp Business app on
                your phone alongside Replai.
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-ink-2 mb-1.5">Phone Number ID</p>
            <div className={readonlyClass}>
              <span className="text-sm font-mono text-ink-2 tracking-wide">
                {client.wa_phone_number_id
                  ? maskPhoneNumberId(client.wa_phone_number_id)
                  : '—'}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-2 mb-1.5">Access token</p>
            <div className={readonlyClass}>
              {isConnected ? (
                <>
                  <CheckCircle2 size={14} strokeWidth={2} className="shrink-0 text-success" />
                  <span className="text-sm text-success font-medium">Connected</span>
                </>
              ) : (
                <>
                  <XCircle size={14} strokeWidth={2} className="shrink-0 text-danger" />
                  <span className="text-sm text-danger font-medium">Not configured</span>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </>
  )
}

// ── Notifications section ─────────────────────────────────────────────────────

function NotificationsSection({
  initialNewConversation,
  initialEscalation,
}: {
  initialNewConversation: boolean
  initialEscalation: boolean
}) {
  const { toast } = useToast()
  const [newConversation, setNewConversation] = useState(initialNewConversation)
  const [escalation, setEscalation] = useState(initialEscalation)
  const [dailySummary, setDailySummary] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await saveNotificationPrefsAction({
      notify_new_conversation_email: newConversation,
      notify_escalation_email: escalation,
    })
    setSaving(false)
    if (res.error) toast.error(res.error)
    else toast.success('Notification preferences saved.')
  }

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold text-ink">Notifications</h3>
      <p className="mb-4 text-xs text-ink-2">Choose when you'd like to receive email alerts.</p>

      <div className="divide-y divide-line/60">
        <Toggle
          label="Email me when a new conversation starts"
          description="Get an email each time a customer messages you for the first time."
          checked={newConversation}
          onChange={setNewConversation}
        />
        <Toggle
          label="Email me when a chat is escalated to a human"
          description="Get an email when the AI hands a conversation to your team."
          checked={escalation}
          onChange={setEscalation}
        />
        <Toggle
          label="Daily summary email"
          description="A morning digest of yesterday's conversations and stats."
          checked={dailySummary}
          onChange={setDailySummary}
        />
      </div>

      <div className="flex justify-end mt-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className={buttonClasses()}
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </Card>
  )
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function SettingsForm({
  email,
  client,
}: {
  email: string
  client: Client
}) {
  const { isOwner, isAgent } = usePermissions()

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          {isAgent
            ? 'Your account and password.'
            : 'Manage your account and agent configuration.'}
        </p>
      </div>

      {/* Section 1 — Account */}
      <Card>
        <h3 className="mb-1 text-sm font-semibold text-ink">Account</h3>
        <p className="mb-5 text-xs text-ink-2">Your login details.</p>

        <div>
          <p className="text-xs font-medium text-ink-2 mb-1.5">Email address</p>
          <div className={readonlyClass}>
            <Mail size={14} strokeWidth={1.75} className="shrink-0 text-ink-3" />
            <span className="text-sm text-ink-2 select-all">{email}</span>
          </div>
          <p className="mt-1.5 text-xs text-ink-3">
            To change your email address, contact support.
          </p>
        </div>
      </Card>

      {/* Section 1b — Change password */}
      <ChangePasswordSection />

      {isOwner && <WhatsAppSection client={client} />}

      {!isAgent && (
        <NotificationsSection
          initialNewConversation={client.notify_new_conversation_email ?? true}
          initialEscalation={client.notify_escalation_email ?? true}
        />
      )}

      {/* Business hours — owners and managers */}
      {!isAgent && (
        <Link
          href="/portal/settings/business-hours"
          className="group flex items-center justify-between rounded-xl border border-line bg-surface shadow-card p-6 hover:border-line-strong hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 group-hover:bg-line transition-colors">
              <Clock size={16} strokeWidth={1.75} className="text-ink-2" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Business Hours</p>
              <p className="text-xs text-ink-2">
                Weekly schedule, closed dates &amp; after-hours messages.
              </p>
            </div>
          </div>
          <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-ink-3 group-hover:text-ink-2 transition-colors" />
        </Link>
      )}
    </div>
  )
}
