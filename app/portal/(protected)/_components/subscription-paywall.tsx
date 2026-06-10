'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getMySubscription,
  reconcileMySubscription,
  type TokenGetter,
} from '@/lib/api'
import { loadPaddle, paddleConfigured, onPaddleEvent } from '@/lib/paddle'
import type { Plan, ClientSubscription } from '@/lib/types'
import { Card } from '@/components/ui'

function isEntitled(sub: ClientSubscription | null): boolean {
  if (!sub) return false
  if (sub.status === 'active') return true
  return (
    sub.status === 'trialing' &&
    (!sub.trial_ends_at || new Date(sub.trial_ends_at).getTime() > Date.now())
  )
}

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function usd(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function SubscriptionPaywall({ isOwner }: { isOwner: boolean }) {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<ClientSubscription | null>(null)
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(isOwner)
  const [activating, setActivating] = useState(false)
  const [activationSlow, setActivationSlow] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await getMySubscription(getFreshToken)
      setPlans(d.plans)
      setSubscription(d.subscription)
    } catch {
      /* leave empty — owner still sees logout / support note */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOwner) load()
  }, [isOwner, load])

  // After Paddle checkout succeeds, the subscription flips to `active` via the
  // webhook a moment later. Poll until it does, then re-render the layout so
  // the portal unlocks automatically (no manual refresh).
  useEffect(() => {
    onPaddleEvent((name) => {
      if (name !== 'checkout.completed') return
      setActivating(true)
      let tries = 0
      const tick = async () => {
        tries += 1
        try {
          const d =
            tries <= 3
              ? await reconcileMySubscription(getFreshToken)
              : await getMySubscription(getFreshToken)
          if (isEntitled(d.subscription)) {
            router.refresh()
            return
          }
        } catch {
          /* keep polling */
        }
        if (tries >= 20) {
          setActivationSlow(true) // ~40s — let them continue manually
          return
        }
        setTimeout(tick, 2000)
      }
      tick()
    })
    return () => onPaddleEvent(null)
  }, [router])

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/portal/login')
  }

  async function choose(planKey: string) {
    const plan = plans.find((p) => p.key === planKey)
    const priceId =
      cycle === 'annual' ? plan?.paddle_price_id_annual : plan?.paddle_price_id_monthly
    if (!paddleConfigured() || !priceId || !subscription) return
    setBusy(planKey)
    const P = await loadPaddle()
    if (!P) {
      setBusy(null)
      return
    }
    const { data } = await createClient().auth.getUser()
    P.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: data.user?.email ? { email: data.user.email } : undefined,
      customData: { client_id: subscription.client_id },
    })
    setBusy(null)
  }

  if (activating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-sm text-center">
          <Loader2 size={24} className="mx-auto animate-spin text-gray-400" />
          <p className="mt-4 text-sm font-medium text-gray-900">
            Activating your subscription…
          </p>
          <p className="mt-1 text-xs text-gray-500">
            This usually takes a few seconds.
          </p>
          {activationSlow && (
            <div className="mt-5 space-y-2">
              <button
                onClick={async () => {
                  try {
                    const d = await reconcileMySubscription(getFreshToken)
                    if (isEntitled(d.subscription)) {
                      router.refresh()
                      return
                    }
                  } catch {
                    /* fall through to reload */
                  }
                  window.location.reload()
                }}
                className="w-full rounded-md bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800"
              >
                I already paid — refresh access
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full text-xs font-medium text-gray-500 underline"
              >
                Reload page
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const channelPlans = plans.filter((p) => p.kind === 'channel')
  const canCheckout = paddleConfigured()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white">
            <Lock size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              Your subscription is inactive
            </h1>
            <p className="text-sm text-gray-500">
              Your free trial has ended or the subscription lapsed.
            </p>
          </div>
        </div>

        {!isOwner ? (
          <Card>
            <p className="text-sm text-gray-700">
              Please ask your account owner to renew the subscription to restore
              access for the team.
            </p>
            <button
              onClick={signOut}
              className="mt-4 text-sm font-medium text-gray-900 underline"
            >
              Log out
            </button>
          </Card>
        ) : loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 size={20} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {!canCheckout && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Online payment isn’t available yet — please contact support to
                reactivate your account.
              </p>
            )}

            <div className="flex items-center gap-2">
              {(['monthly', 'annual'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                    cycle === c
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c}
                  {c === 'annual' && <span className="ml-1 opacity-70">−20%</span>}
                </button>
              ))}
            </div>

            {channelPlans.map((plan) => {
              const price =
                cycle === 'annual' ? plan.price_annual ?? plan.price : plan.price
              const isScale = plan.key === 'scale'
              return (
                <div
                  key={plan.key}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {plan.name}
                    </p>
                    <p className="text-xs text-gray-500">{plan.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {isScale ? 'Custom' : `${usd(price)}/mo`}
                    </span>
                    {isScale ? (
                      <a
                        href="mailto:hello@replai.co.za?subject=Replai%20Scale"
                        className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                      >
                        Contact sales
                      </a>
                    ) : (
                      <button
                        onClick={() => choose(plan.key)}
                        disabled={!canCheckout || busy === plan.key}
                        className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        {busy === plan.key ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          'Subscribe'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            <button
              onClick={signOut}
              className="text-sm font-medium text-gray-500 underline"
            >
              Log out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
