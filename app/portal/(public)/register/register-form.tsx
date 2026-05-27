'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signupPortal } from '@/lib/api'

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
    : '/portal'

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
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Start your free trial</h1>
      <p className="mt-1 text-sm text-gray-500">
        14 days free. No card required to start.
      </p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Business name
          </label>
          <input
            name="business_name"
            required
            autoComplete="organization"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Work email
          </label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-400">At least 8 characters.</p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {pending ? 'Creating your workspace…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/portal/login" className="font-medium text-gray-900 underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
