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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Reset password</h1>
          <p className="mt-1 text-sm text-gray-500">
            {status === 'done'
              ? 'Check your inbox.'
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {status === 'done' ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 shadow-sm text-center space-y-4">
            <p className="text-sm text-gray-600">
              If that email is registered, you&apos;ll receive a password reset link shortly.
            </p>
            <Link
              href="/portal/login"
              className="inline-block text-sm font-medium text-gray-900 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 shadow-sm space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3D6BF8] focus:outline-none focus:ring-1 focus:ring-[#3D6BF8]"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-md bg-[#1E0B6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d1499] focus:outline-none focus:ring-2 focus:ring-[#3D6BF8] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'loading' ? 'Sending…' : 'Send reset link'}
            </button>

            <p className="text-center text-xs text-gray-400">
              <Link
                href="/portal/login"
                className="hover:text-gray-600 transition-colors"
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
