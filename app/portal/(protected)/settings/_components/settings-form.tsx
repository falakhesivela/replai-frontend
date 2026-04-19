'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
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
} from 'lucide-react'
import { changePasswordAction, updateCredentialsAction, type PasswordState, type CredentialsState } from '../actions'
import { useToast } from '@/components/toast'
import { usePermissions } from '@/hooks/usePermissions'
import type { Client } from '@/lib/types'

// ── Shared primitives ─────────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3D6BF8] focus:outline-none focus:ring-1 focus:ring-[#3D6BF8]'

const readonlyClass =
  'flex items-center gap-2.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2'

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
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
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
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
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
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
      className="inline-flex items-center gap-2 rounded-md bg-[#1E0B6F] px-3 py-2 text-sm font-medium text-white hover:bg-[#2d1499] focus:outline-none focus:ring-2 focus:ring-[#3D6BF8] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Change password</h3>
      <p className="mb-5 text-xs text-gray-500">Choose a strong password at least 8 characters long.</p>

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
          <p className="text-xs text-red-600">{state.fieldError}</p>
        )}

        <div className="flex justify-end pt-1">
          <PasswordSaveButton />
        </div>
      </form>
    </section>
  )
}

// ── WhatsApp credentials modal ────────────────────────────────────────────────

function CredentialsSaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-[#1E0B6F] px-3 py-2 text-sm font-medium text-white hover:bg-[#2d1499] focus:outline-none focus:ring-2 focus:ring-[#3D6BF8] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      <div className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <h4 className="text-sm font-semibold text-gray-900">Update WhatsApp credentials</h4>
        <p className="mt-1 mb-5 text-xs text-gray-500">
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
              className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3D6BF8] focus:outline-none focus:ring-1 focus:ring-[#3D6BF8] font-mono text-xs"
            />
            <p className="mt-1 text-xs text-gray-400">
              Find this in Meta for Developers → WhatsApp → API Setup.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
  const isConnected = !!client.wa_access_token

  return (
    <>
      {modalOpen && <UpdateCredentialsModal onClose={() => setModalOpen(false)} />}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">WhatsApp connection</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Your connected WhatsApp Business number.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Update credentials
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Connected number</p>
            <div className={readonlyClass}>
              <Phone size={14} strokeWidth={1.75} className="shrink-0 text-gray-400" />
              <span className="text-sm text-gray-700">
                {client.wa_phone_number || '—'}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Phone Number ID</p>
            <div className={readonlyClass}>
              <span className="text-sm font-mono text-gray-600 tracking-wide">
                {client.wa_phone_number_id
                  ? maskPhoneNumberId(client.wa_phone_number_id)
                  : '—'}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Access token</p>
            <div className={readonlyClass}>
              {isConnected ? (
                <>
                  <CheckCircle2 size={14} strokeWidth={2} className="shrink-0 text-green-500" />
                  <span className="text-sm text-green-700 font-medium">Connected</span>
                </>
              ) : (
                <>
                  <XCircle size={14} strokeWidth={2} className="shrink-0 text-red-400" />
                  <span className="text-sm text-red-600 font-medium">Not configured</span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

// ── Notifications section ─────────────────────────────────────────────────────

function NotificationsSection() {
  const { toast } = useToast()
  const [escalation, setEscalation] = useState(true)
  const [dailySummary, setDailySummary] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    // UI-only: simulate a short save delay
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    toast.success('Notification preferences saved.')
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Notifications</h3>
      <p className="mb-4 text-xs text-gray-500">Choose when you'd like to receive email alerts.</p>

      <div className="divide-y divide-gray-50">
        <Toggle
          label="Email me when AI escalates to human"
          description="Get notified when a customer needs human support."
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
          className="inline-flex items-center gap-2 rounded-md bg-[#1E0B6F] px-3 py-2 text-sm font-medium text-white hover:bg-[#2d1499] focus:outline-none focus:ring-2 focus:ring-[#3D6BF8] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </section>
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
        <h2 className="text-base font-semibold text-gray-900">Settings</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          {isAgent
            ? 'Your account and password.'
            : 'Manage your account and agent configuration.'}
        </p>
      </div>

      {/* Section 1 — Account */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Account</h3>
        <p className="mb-5 text-xs text-gray-500">Your login details.</p>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Email address</p>
          <div className={readonlyClass}>
            <Mail size={14} strokeWidth={1.75} className="shrink-0 text-gray-400" />
            <span className="text-sm text-gray-600 select-all">{email}</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            To change your email address, contact support.
          </p>
        </div>
      </section>

      {/* Section 1b — Change password */}
      <ChangePasswordSection />

      {isOwner && <WhatsAppSection client={client} />}

      {!isAgent && <NotificationsSection />}

      {/* Business hours — owners and managers */}
      {!isAgent && (
        <Link
          href="/portal/settings/business-hours"
          className="group flex items-center justify-between rounded-lg border border-gray-200 bg-white p-6 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 group-hover:bg-gray-200 transition-colors">
              <Clock size={16} strokeWidth={1.75} className="text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Business Hours</p>
              <p className="text-xs text-gray-500">
                Weekly schedule, closed dates &amp; after-hours messages.
              </p>
            </div>
          </div>
          <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </Link>
      )}
    </div>
  )
}
