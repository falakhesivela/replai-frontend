'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setStatus('loading')

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/portal/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setStatus('idle')
      return
    }

    setStatus('done')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-ink">Reset password</h1>
          <p className="mt-1 text-sm text-ink-2">
            {status === 'done'
              ? 'Check your inbox.'
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {status === 'done' ? (
          <div className="bg-surface rounded-xl border border-line p-6 sm:p-8 shadow-card text-center space-y-4">
            <p className="text-sm text-ink-2">
              If that email is registered, you&apos;ll receive a password reset link shortly.
            </p>
            <Link
              href="/portal/login"
              className="inline-block text-sm font-medium text-ink hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-surface rounded-xl border border-line p-6 sm:p-8 shadow-card space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-ink-2 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-xs placeholder:text-ink-3 transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger-soft border border-danger/25 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-solid shadow-sm shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-md hover:shadow-accent/25 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Sending…' : 'Send reset link'}
            </button>

            <p className="text-center text-xs text-ink-3">
              <Link
                href="/portal/login"
                className="hover:text-ink-2 transition-colors"
              >
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
