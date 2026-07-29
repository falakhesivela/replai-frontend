'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { resolvePortalLanding } from '@/lib/portal-login'
import { PortalLegalFooter } from '@/app/portal/_components/portal-legal-footer'

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
  }

  return (
    <div className="min-h-screen flex bg-canvas">
      {/* Left branded panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between px-12 py-12 m-4 rounded-3xl shadow-overlay">
        <Image
          src="/images/woman_agent.jpg"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-accent/90 via-accent/40 to-accent/60" />

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
          <h2 className="text-3xl font-bold text-on-solid leading-snug">
            Your AI-powered<br />customer assistant
          </h2>
          <p className="mt-3 text-on-solid/80 text-sm max-w-xs">
            Automate conversations, manage bookings, sell products, and delight your customers — 24/7.
          </p>
        </div>

        <p className="relative z-10 text-on-solid/40 text-xs">© {new Date().getFullYear()} ReplAI</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Image
              src="/images/replai_logo.png"
              alt="Replai"
              width={110}
              height={33}
              className="object-contain dark:brightness-0 dark:invert"
              priority
            />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink">Welcome back</h1>
            <p className="mt-1 text-sm text-ink-2">Sign in to your client portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink-2 mb-1">
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

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-ink-2">
                  Password
                </label>
                <Link
                  href="/portal/forgot-password"
                  className="text-xs text-accent-text hover:text-accent transition-colors"
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
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-xs placeholder:text-ink-3 transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                placeholder="••••••••"
              />
            </div>

            {successMessage && (
              <p className="text-sm text-success bg-success-soft border border-success/25 rounded-lg px-3 py-2">
                {successMessage}
              </p>
            )}

            {message && (
              <p className="text-sm text-danger bg-danger-soft border border-danger/25 rounded-lg px-3 py-2">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-sm shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-md hover:shadow-accent/25 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-ink-3">
            Need an account?{' '}
            <span className="text-ink-2">Contact us.</span>
          </p>

          <PortalLegalFooter className="mt-6" />
        </div>
      </div>
    </div>
  )
}
