'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Loader2, CheckCircle2, Copy, Check, ArrowRight } from 'lucide-react'
import { createClientAction, type CreateClientState } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-on-solid hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending && <Loader2 size={14} className="animate-spin" />}
      {pending ? 'Creating…' : 'Create client'}
    </button>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors'

function inputCx(error?: string) {
  return `${inputClass} ${
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 focus:border-gray-900 focus:ring-gray-900'
  }`
}

function CopyablePassword({ password }: { password: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 select-all">
        {password}
      </div>
      <button
        onClick={handleCopy}
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {copied ? (
          <Check size={13} strokeWidth={2} className="text-green-600" />
        ) : (
          <Copy size={13} strokeWidth={1.75} />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function SuccessPanel({
  clientId,
  temporaryPassword,
}: {
  clientId: string
  temporaryPassword: string
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-gray-200/70 bg-white shadow-card p-8">
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle2 size={22} strokeWidth={1.75} className="text-green-500 shrink-0" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Client created</h1>
            <p className="text-sm text-gray-500">Share the login details below with your client.</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Temporary password
            </p>
            <CopyablePassword password={temporaryPassword} />
            <p className="mt-2 text-xs text-gray-500">
              Share this with your client. They can change it after logging in.
            </p>
          </div>

          <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            The client will use this to log in at{' '}
            <span className="font-mono font-medium">
              your-dashboard.vercel.app/portal/login
            </span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Link
            href={`/dashboard/clients/${clientId}`}
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-on-solid hover:bg-gray-700 transition-colors"
          >
            View client
            <ArrowRight size={14} strokeWidth={2} />
          </Link>
          <Link
            href="/dashboard/clients/new"
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Add another
          </Link>
        </div>
      </div>
    </div>
  )
}

const initialState: CreateClientState = {}

export default function NewClientPage() {
  const [state, action] = useActionState(createClientAction, initialState)
  const e = state.errors ?? {}

  if (state.success) {
    return (
      <SuccessPanel
        clientId={state.success.clientId}
        temporaryPassword={state.success.temporaryPassword}
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/dashboard/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        ← All clients
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">New client</h1>
        <p className="mt-1 text-sm text-gray-500">
          Fill in the details below to onboard a new client.
        </p>
      </div>

      <form action={action} className="space-y-5 rounded-xl border border-gray-200/70 bg-white shadow-card p-6">
        {e._form && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {e._form}
          </div>
        )}

        <Field label="Business name" error={e.business_name}>
          <input
            name="business_name"
            type="text"
            required
            placeholder="Acme Corp"
            className={inputCx(e.business_name)}
          />
        </Field>

        <Field label="Client email" error={e.client_email}>
          <input
            name="client_email"
            type="email"
            required
            placeholder="owner@acmecorp.com"
            className={inputCx(e.client_email)}
          />
          <p className="mt-1.5 text-xs text-gray-400">
            Used to create their portal login account.
          </p>
        </Field>

        <Field label="WhatsApp phone number" error={e.wa_phone_number}>
          <input
            name="wa_phone_number"
            type="text"
            required
            placeholder="+27831234567"
            className={inputCx(e.wa_phone_number)}
          />
        </Field>

        <Field label="WhatsApp Phone Number ID" error={e.wa_phone_number_id}>
          <input
            name="wa_phone_number_id"
            type="text"
            required
            placeholder="123456789012345"
            className={inputCx(e.wa_phone_number_id)}
          />
        </Field>

        <Field label="WhatsApp Access Token" error={e.wa_access_token}>
          <input
            name="wa_access_token"
            type="password"
            required
            placeholder="EAAxxxxxx…"
            className={inputCx(e.wa_access_token)}
          />
        </Field>

        <Field label="System prompt" error={e.system_prompt}>
          <textarea
            name="system_prompt"
            required
            rows={8}
            placeholder="You are a helpful support agent for {business}…"
            className={`${inputCx(e.system_prompt)} resize-y`}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Personality and instructions for the AI agent. Be specific about tone and topics.
          </p>
        </Field>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/dashboard/clients"
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </Link>
          <SubmitButton />
        </div>
      </form>
    </div>
  )
}
