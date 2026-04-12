'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { resolvePortalLanding } from '@/lib/portal-login'

const NO_ACCOUNT_MSG =
  'No portal access for this account. Contact your administrator.'

interface PortalLoginFormProps {
  /** Set when middleware sent an authenticated user without portal access. */
  accountError: boolean
  /** Safe in-app path after login (must start with /portal). */
  nextPath?: string
  /** Set when the user just completed a password reset. */
  passwordReset?: boolean
}

export function PortalLoginForm({ accountError, nextPath, passwordReset }: PortalLoginFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!accountError) return
    void createClient().auth.signOut()
  }, [accountError])

  const message = error ?? (accountError ? NO_ACCOUNT_MSG : null)
  const successMessage = passwordReset ? 'Password updated. Sign in with your new password.' : null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const supabase = createClient()
    const { data: authData, error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signErr) {
      setError(signErr.message)
      setPending(false)
      return
    }

    const user = authData.user
    if (!user) {
      setError('Sign-in failed.')
      setPending(false)
      return
    }

    const resolved = await resolvePortalLanding(supabase, user.id)
    if ('error' in resolved) {
      await supabase.auth.signOut()
      setError(NO_ACCOUNT_MSG)
      setPending(false)
      return
    }

    const destination =
      nextPath && nextPath.startsWith('/portal') ? nextPath : resolved.path
    router.push(destination)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Client Portal</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in for business owners and team members</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8 shadow-sm space-y-5"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link
                href="/portal/forgot-password"
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="••••••••"
            />
          </div>

          {successMessage && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              {successMessage}
            </p>
          )}

          {message && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Need an account?{' '}
          <span className="text-gray-500">Contact us.</span>
        </p>
      </div>
    </div>
  )
}
