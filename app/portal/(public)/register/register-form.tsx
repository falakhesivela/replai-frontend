'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signupPortal } from '@/lib/api'
import { LEGAL_LINKS } from '@/lib/marketing-site'
import { PortalLegalFooter } from '@/app/portal/_components/portal-legal-footer'

const CHANNEL_PLANS = ['website', 'whatsapp', 'both'] as const

export function RegisterForm({
  plan,
  cycle,
}: {
  plan?: string
  cycle?: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Preserve a valid plan/cycle choice from the marketing site through signup.
  const intendedPlan = CHANNEL_PLANS.includes(plan as never) ? plan : null
  const intendedCycle = cycle === 'annual' ? 'annual' : 'monthly'
  const postSignup = intendedPlan
    ? `/portal/subscription?plan=${intendedPlan}&cycle=${intendedCycle}`
    : '/portal/onboarding'

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)

    const fd = new FormData(e.currentTarget)
    const business_name = String(fd.get('business_name') ?? '').trim()
    const email = String(fd.get('email') ?? '').trim()
    const password = String(fd.get('password') ?? '')

    try {
      await signupPortal({ business_name, email, password })

      const supabase = createClient()
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signErr) {
        // Account exists but auto sign-in failed — send them to login.
        router.push('/portal/login')
        return
      }
      router.push(postSignup)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed.')
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-canvas px-6 py-12">
      <div className="mx-auto w-full max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/replai_logo.png"
          alt="Replai"
          className="mx-auto mb-8 h-8 w-auto object-contain"
        />

        <div className="rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Start your free trial
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            14 days free. No card required to start.
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-2">
            Business name
          </label>
          <input
            name="business_name"
            required
            autoComplete="organization"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-xs transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-2">
            Work email
          </label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-xs transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-2">
            Password
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-xs transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <p className="mt-1 text-xs text-ink-3">At least 8 characters.</p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-solid shadow-sm shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-md hover:shadow-accent/25 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Creating your workspace…' : 'Create account'}
        </button>

        <p className="text-center text-xs text-ink-3 leading-relaxed">
          By creating an account you agree to our{' '}
          <a
            href={LEGAL_LINKS[0].href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            Terms
          </a>{' '}
          and{' '}
          <a
            href={LEGAL_LINKS[1].href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-2 underline underline-offset-2 hover:text-ink"
          >
            Privacy Policy
          </a>
          .
        </p>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-2">
          Already have an account?{' '}
          <Link
            href="/portal/login"
            className="font-medium text-accent transition-colors hover:text-accent-text"
          >
            Log in
          </Link>
        </p>

        <PortalLegalFooter className="mt-8" />
      </div>
    </div>
  )
}
