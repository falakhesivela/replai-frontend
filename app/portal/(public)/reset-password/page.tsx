'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { resetPasswordAction, type ResetPasswordState } from './actions'

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-xs placeholder:text-ink-3 transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25'

const initialState: ResetPasswordState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-solid shadow-sm shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-md hover:shadow-accent/25 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending && <Loader2 size={13} className="animate-spin" />}
      {pending ? 'Updating…' : 'Set new password'}
    </button>
  )
}

export default function ResetPasswordPage() {
  const [state, action] = useActionState(resetPasswordAction, initialState)

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-ink">Set new password</h1>
          <p className="mt-1 text-sm text-ink-2">Choose a new password for your account.</p>
        </div>

        <form
          action={action}
          className="bg-surface rounded-xl border border-line p-6 sm:p-8 shadow-card space-y-5"
        >
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink-2 mb-1">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-ink-2 mb-1">
              Confirm new password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          {(state.fieldError || state.error) && (
            <p className="text-sm text-danger bg-danger-soft border border-danger/25 rounded-md px-3 py-2">
              {state.fieldError ?? state.error}
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
