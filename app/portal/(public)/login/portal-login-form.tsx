'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
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
    <div className="min-h-screen flex">
      {/* Left branded panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between px-12 py-12">
        <Image
          src="/images/woman_agent.jpg"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1E0B6F]/90 via-[#1E0B6F]/40 to-[#1E0B6F]/60" />

        <div className="relative z-10 w-full">
          <Image
            src="/images/replai_logo.png"
            alt="Replai"
            width={120}
            height={36}
            className="object-contain brightness-0 invert"
            priority
          />
        </div>

        <div className="relative z-10 text-left">
          <h2 className="text-3xl font-bold text-white leading-snug">
            Your AI-powered<br />customer assistant
          </h2>
          <p className="mt-3 text-blue-100 text-sm max-w-xs">
            Automate conversations, manage bookings, and delight your customers — 24/7.
          </p>
        </div>

        <p className="relative z-10 text-white/40 text-xs">© {new Date().getFullYear()} ReplAI</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Image
              src="/images/replai_logo.png"
              alt="Replai"
              width={110}
              height={33}
              className="object-contain"
              priority
            />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-500">Sign in to your client portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3D6BF8] focus:outline-none focus:ring-1 focus:ring-[#3D6BF8] bg-white"
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
                  className="text-xs text-[#3D6BF8] hover:text-[#1E0B6F] transition-colors"
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3D6BF8] focus:outline-none focus:ring-1 focus:ring-[#3D6BF8] bg-white"
                placeholder="••••••••"
              />
            </div>

            {successMessage && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {successMessage}
              </p>
            )}

            {message && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-[#1E0B6F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2d1499] focus:outline-none focus:ring-2 focus:ring-[#3D6BF8] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-400">
            Need an account?{' '}
            <span className="text-gray-500">Contact us.</span>
          </p>
        </div>
      </div>
    </div>
  )
}
