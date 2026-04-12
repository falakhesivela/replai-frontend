'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, KeyRound } from 'lucide-react'
import { changePasswordAction, type PasswordState } from '../actions'
import { useToast } from '@/components/toast'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <KeyRound size={13} strokeWidth={2} />
      )}
      {pending ? 'Updating…' : 'Update password'}
    </button>
  )
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900'

const initialState: PasswordState = {}

export default function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initialState)
  const { toast } = useToast()
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (state.success) {
      toast.success('Password updated successfully.')
      setKey((k) => k + 1) // reset form fields
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, toast])

  return (
    <form key={key} action={action} className="space-y-4">
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

      {state.fieldError && (
        <p className="text-xs text-red-600">{state.fieldError}</p>
      )}

      <div className="flex justify-end pt-1">
        <SubmitButton />
      </div>
    </form>
  )
}
