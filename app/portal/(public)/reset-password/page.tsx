'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { resetPasswordAction, type ResetPasswordState } from './actions'

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900'

const initialState: ResetPasswordState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending && <Loader2 size={13} className="animate-spin" />}
      {pending ? 'Updating…' : 'Set new password'}
    </button>
  )
}

export default function ResetPasswordPage() {
  const [state, action] = useActionState(resetPasswordAction, initialState)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Set new password</h1>
          <p className="mt-1 text-sm text-gray-500">Choose a new password for your account.</p>
        </div>

        <form
          action={action}
          className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 shadow-sm space-y-5"
        >
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
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
            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1">
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
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {state.fieldError ?? state.error}
            </p>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
