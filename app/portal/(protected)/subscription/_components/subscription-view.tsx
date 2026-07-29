'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CreditCard, Loader2, ToggleLeft, ToggleRight, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getMySubscription,
  reconcileMySubscription,
  toggleMyFeature,
  setMyPlan,
  cancelMySubscription,
  PortalAuthError,
  type TokenGetter,
} from '@/lib/api'
import { loadPaddle, paddleConfigured, onPaddleEvent } from '@/lib/paddle'
import { LEGAL_LINKS } from '@/lib/marketing-site'
import type { Plan, ClientSubscription, ClientUsageBilling } from '@/lib/types'
import { Card, ConfirmDialog } from '@/components/ui'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function fmt(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

const USAGE_BADGE: Record<string, { label: string; cls: string }> = {
  ok: { label: 'On plan', cls: 'bg-success-soft text-success' },
  approaching: { label: 'Near cap', cls: 'bg-warning-soft text-warning' },
  over: { label: 'Over cap', cls: 'bg-danger-soft text-danger' },
  unlimited: { label: 'Unlimited', cls: 'bg-surface-2 text-ink-2' },
  no_subscription: { label: 'No plan', cls: 'bg-surface-2 text-ink-2' },
}

export default function SubscriptionView() {
  const sp = useSearchParams()
  // Plan/cycle carried over from the marketing site (via signup).
  const intendedPlan = sp.get('plan')
  const intendedCycle = sp.get('cycle') === 'annual' ? 'annual' : null

  const [subscription, setSubscription] = useState<ClientSubscription | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [usage, setUsage] = useState<ClientUsageBilling | null>(null)
  const [cycle, setCycle] = useState<'monthly' | 'annual'>(
    intendedCycle ?? 'monthly'
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [trialEligibleAddons, setTrialEligibleAddons] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const detail = await getMySubscription(getFreshToken)
      setSubscription(detail.subscription)
      setPlans(detail.plans)
      setUsage(detail.usage ?? null)
      setTrialEligibleAddons(detail.trial_eligible_addons ?? [])
      // Don't override a cycle the user just chose on the pricing page.
      if (!intendedCycle && detail.subscription?.billing_cycle) {
        setCycle(detail.subscription.billing_cycle)
      }
    } catch (err) {
      setError(
        err instanceof PortalAuthError
          ? 'Session expired. Please refresh the page.'
          : 'Failed to load subscription.'
      )
    } finally {
      setLoading(false)
    }
  }, [intendedCycle])

  useEffect(() => { load() }, [load])

  // Reflect a completed Paddle checkout without a manual refresh — the plan
  // change lands via the webhook a moment later, so re-pull a few times.
  useEffect(() => {
    onPaddleEvent((name) => {
      if (name !== 'checkout.completed') return
      let tries = 0
      const tick = async () => {
        tries += 1
        if (tries <= 3) {
          try {
            await reconcileMySubscription(getFreshToken)
          } catch {
            /* webhook may still be enough */
          }
        }
        load()
        if (tries < 8) setTimeout(tick, 2500)
      }
      setTimeout(tick, 1500)
    })
    return () => onPaddleEvent(null)
  }, [load])

  async function choosePlan(planKey: string) {
    setBusyKey(planKey)
    setError(null)
    try {
      const plan = plans.find((p) => p.key === planKey)
      const priceId =
        cycle === 'annual'
          ? plan?.paddle_price_id_annual
          : plan?.paddle_price_id_monthly

      // Real payment path — open Paddle checkout; the subscription then
      // syncs via the Paddle webhook (no optimistic local update).
      if (paddleConfigured() && priceId && subscription) {
        const P = await loadPaddle()
        if (P) {
          const { data } = await createClient().auth.getUser()
          P.Checkout.open({
            items: [{ priceId, quantity: 1 }],
            customer: data.user?.email ? { email: data.user.email } : undefined,
            customData: { client_id: subscription.client_id },
          })
          return
        }
      }

      // Fallback (pre-Paddle): reserve the plan internally, no charge.
      const r = await setMyPlan(getFreshToken, planKey, cycle)
      setSubscription(r.subscription)
    } catch {
      setError('Could not change plan. Please try again.')
    } finally {
      setBusyKey(null)
    }
  }

  async function toggleAddon(planKey: string, enabled: boolean) {
    setBusyKey(planKey)
    setError(null)
    try {
      const r = await toggleMyFeature(getFreshToken, planKey, enabled)
      setSubscription(r.subscription)
      setPlans((prev) =>
        prev.map((p) =>
          p.key === planKey
            ? { ...p, enabled, enabled_at: enabled ? new Date().toISOString() : null }
            : p
        )
      )
    } catch {
      setError('Could not update add-on. Please try again.')
    } finally {
      setBusyKey(null)
    }
  }

  function cancelConfirmMessage(): string {
    const onPaddle = Boolean(subscription?.paddle_subscription_id)
    const isTrialOnly =
      (subscription?.status === 'trialing' || subscription?.plan_key === 'trial') &&
      !onPaddle
    return isTrialOnly
      ? 'End your free trial now? You will lose access to paid features immediately.'
      : onPaddle
        ? 'Cancel your subscription? You will keep access until the end of your current billing period and will not be charged again.'
        : 'Cancel your subscription? You will lose access immediately.'
  }

  async function cancelSubscription() {
    setConfirmCancel(false)
    setCancelling(true)
    setError(null)
    try {
      const detail = await cancelMySubscription(getFreshToken)
      setSubscription(detail.subscription)
      setPlans(detail.plans)
      setUsage(detail.usage ?? null)
      setTrialEligibleAddons(detail.trial_eligible_addons ?? [])
    } catch {
      setError('Could not cancel subscription. Please try again or contact support.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-ink-3" />
      </div>
    )
  }

  const currency = subscription?.currency ?? 'USD'
  const channelPlans = plans.filter((p) => p.kind === 'channel')
  const addons = plans.filter((p) => p.kind === 'addon')
  const currentPlan = subscription?.plan_key ?? null
  const badge = usage ? USAGE_BADGE[usage.state] : null

  const planPrice = (p: Plan) =>
    cycle === 'annual' ? (p.price_annual ?? p.price) : p.price

  const isTrial = subscription?.status === 'trialing' || currentPlan === 'trial'
  const addonEligibleOnTrial = (key: string) =>
    trialEligibleAddons.includes(key)
  const channelPlan = channelPlans.find((p) => p.key === currentPlan) ?? null
  const enabledAddons = addons.filter((p) => p.enabled)
  const cancelScheduledAt = subscription?.cancel_scheduled_at ?? null
  const isCancelled = subscription?.status === 'cancelled'
  const canCancel =
    !isCancelled &&
    !cancelScheduledAt &&
    (subscription?.status === 'trialing' ||
      subscription?.status === 'active' ||
      subscription?.status === 'past_due')
  const cancelLabel =
    isTrial && !subscription?.paddle_subscription_id
      ? 'End free trial'
      : 'Cancel subscription'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Subscription</h1>
        <p className="mt-0.5 text-sm text-ink-2">
          Pick a channel plan and add the modules you need.
        </p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {cancelScheduledAt && !isCancelled && (
        <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          Your subscription is scheduled to cancel on{' '}
          <strong>
            {new Date(cancelScheduledAt).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </strong>
          . You will keep access until then and will not be charged again.
        </div>
      )}

      {isCancelled && (
        <div className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
          Your subscription has been cancelled. You can resubscribe any time by
          choosing a plan below.
        </div>
      )}

      {/* Billing + usage summary */}
      <Card padding="sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2">
              <CreditCard size={16} className="text-ink-2" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Monthly total</p>
              {subscription?.status && (
                <p className="text-xs text-ink-3 capitalize">
                  {subscription.status}
                  {subscription.trial_ends_at && subscription.status === 'trialing'
                    ? ` · trial ends ${new Date(
                        subscription.trial_ends_at
                      ).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`
                    : ''}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-ink">
              {fmt(subscription?.total_price ?? 0, currency)}
            </p>
            <p className="text-xs text-ink-3">/month</p>
          </div>
        </div>

        {/* What you're paying for: chosen plan + active add-ons + total. */}
        {(channelPlan || isTrial || enabledAddons.length > 0) && (
          <div className="mt-4 rounded-lg border border-line p-3">
            <p className="mb-2 text-xs font-medium text-ink-2">Your plan</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-2">
                  {channelPlan
                    ? channelPlan.name
                    : isTrial
                      ? 'Free trial'
                      : 'No plan selected'}
                </span>
                <span className="text-ink">
                  {channelPlan
                    ? `${fmt(planPrice(channelPlan), currency)}/mo`
                    : isTrial
                      ? 'Free'
                      : '—'}
                </span>
              </div>
              {!isTrial &&
                enabledAddons.map((a) => (
                  <div
                    key={a.key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-ink-2">{a.name}</span>
                    <span className="text-ink-2">
                      +{fmt(a.price, currency)}/mo
                    </span>
                  </div>
                ))}
              {isTrial && enabledAddons.length > 0 && (
                <p className="text-[11px] text-ink-3">
                  Trial add-ons: {enabledAddons.map((a) => a.name).join(', ')}.
                </p>
              )}
              <div className="mt-1.5 flex items-center justify-between border-t border-line pt-2 text-sm font-semibold">
                <span className="text-ink">Total</span>
                <span className="text-ink">
                  {fmt(isTrial ? 0 : (subscription?.total_price ?? 0), currency)}
                  <span className="font-normal text-ink-3">/mo</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {usage && usage.state !== 'no_subscription' && (
          <div className="mt-4 rounded-lg border border-line p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-ink-2">
                Conversations this period
              </p>
              {badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.cls}`}
                >
                  {badge.label}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-ink">
              {usage.used.toLocaleString()}
              {usage.included != null
                ? ` / ${usage.included.toLocaleString()}`
                : ' (no cap)'}
            </p>
            {usage.included != null && (
              <div className="mt-2 h-1.5 rounded-full bg-surface-2">
                <div
                  className={`h-1.5 rounded-full ${
                    usage.state === 'over'
                      ? 'bg-danger'
                      : usage.state === 'approaching'
                        ? 'bg-warning'
                        : 'bg-success'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      usage.included
                        ? Math.round((usage.used / usage.included) * 100)
                        : 0
                    )}%`,
                  }}
                />
              </div>
            )}
            {usage.overage_conversations > 0 && (
              <p className="mt-2 text-xs text-warning">
                {usage.overage_conversations.toLocaleString()} over your
                allowance. Extra conversations are{' '}
                {fmt(usage.overage_rate_usd ?? 0.04, currency)} each — consider
                upgrading.
              </p>
            )}
          </div>
        )}

        {/* WhatsApp messages — only when the plan includes them */}
        {usage &&
          usage.wa_included != null &&
          (usage.wa_included > 0 || (usage.wa_used ?? 0) > 0) && (
            <div className="mt-4 rounded-lg border border-line p-3">
              <p className="mb-1.5 text-xs font-medium text-ink-2">
                WhatsApp messages this period
              </p>
              <p className="text-sm font-semibold text-ink">
                {(usage.wa_used ?? 0).toLocaleString()}
                {usage.wa_included != null
                  ? ` / ${usage.wa_included.toLocaleString()} billable`
                  : ' billable'}
              </p>
              {usage.wa_included != null && usage.wa_included > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-surface-2">
                  <div
                    className={`h-1.5 rounded-full ${
                      (usage.wa_overage_messages ?? 0) > 0
                        ? 'bg-danger'
                        : (usage.wa_used ?? 0) / usage.wa_included >= 0.8
                          ? 'bg-warning'
                          : 'bg-success'
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          ((usage.wa_used ?? 0) / usage.wa_included) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
              )}
              {(usage.wa_overage_messages ?? 0) > 0 && (
                <p className="mt-2 text-xs text-warning">
                  {(usage.wa_overage_messages ?? 0).toLocaleString()} over your
                  WhatsApp allowance. Extra messages are{' '}
                  {fmt(usage.wa_overage_rate_usd ?? 0.04, currency)} each.
                </p>
              )}
              <p className="mt-2 text-[11px] text-ink-3">
                Service replies (to customer-initiated chats) are free —
                only marketing, utility and authentication messages count.
              </p>
            </div>
          )}

        <div className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
          <p className="text-xs text-ink-2">
            Payments are processed securely by Paddle, the Merchant of Record for
            Replai orders. Your plan and any add-ons are billed{' '}
            {cycle === 'annual' ? 'annually' : 'monthly'}; add-on changes are
            prorated immediately. See our{' '}
            <a
              href={LEGAL_LINKS[2].href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              Refund policy
            </a>{' '}
            and{' '}
            <a
              href={LEGAL_LINKS[0].href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              Terms
            </a>
            .
          </p>
        </div>

        {canCancel && (
          <div className="mt-4 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={cancelling}
              className="text-sm font-medium text-danger hover:text-danger disabled:opacity-50"
            >
              {cancelling ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" />
                  Cancelling…
                </span>
              ) : (
                cancelLabel
              )}
            </button>
          </div>
        )}
      </Card>

      {/* Billing cycle */}
      <div className="flex items-center gap-2">
        {(['monthly', 'annual'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCycle(c)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              cycle === c
                ? 'bg-accent text-on-solid'
                : 'bg-surface-2 text-ink-2 hover:bg-line'
            }`}
          >
            {c}
            {c === 'annual' && <span className="ml-1 opacity-70">−20%</span>}
          </button>
        ))}
      </div>

      {/* Channel plans */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-ink-2">Channel plan</h2>
        {channelPlans.map((plan) => {
          const isCurrent = currentPlan === plan.key
          const isScale = plan.key === 'scale'
          const isIntended = !isCurrent && plan.key === intendedPlan
          return (
            <div
              key={plan.key}
              className={`rounded-lg border p-5 transition-colors ${
                isCurrent
                  ? 'border-accent bg-accent-soft'
                  : isIntended
                    ? 'border-accent ring-1 ring-accent'
                    : 'border-line bg-surface'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {plan.name}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                        Current
                      </span>
                    )}
                    {isIntended && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                        Your pick
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-ink-2">
                    {plan.description}
                  </p>
                  {plan.included_conversations != null && (
                    <p className="mt-1.5 text-[11px] text-ink-3">
                      {plan.included_conversations.toLocaleString()} conversations / mo
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {isScale ? 'Custom' : fmt(planPrice(plan), currency)}
                    {!isScale && (
                      <span className="text-xs font-normal text-ink-3">/mo</span>
                    )}
                  </span>
                  {isScale ? (
                    <a
                      href="mailto:hello@replai.co.za?subject=Replai%20Scale%20enquiry"
                      className="rounded-md bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-line"
                    >
                      Contact sales
                    </a>
                  ) : isCurrent ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <Check size={13} /> Selected
                    </span>
                  ) : (
                    <button
                      onClick={() => choosePlan(plan.key)}
                      disabled={busyKey === plan.key}
                      className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-on-solid hover:bg-accent-hover disabled:opacity-50"
                    >
                      {busyKey === plan.key ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        'Choose'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add-ons */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-ink-2">Add-ons</h2>
        {addons.map((plan) => (
          <div
            key={plan.key}
            className={`rounded-lg border p-5 transition-colors ${
              plan.enabled ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {plan.name}
                  </span>
                  {plan.enabled && (
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-ink-2">
                  {plan.description}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-sm font-semibold text-ink">
                  +{fmt(plan.price, currency)}
                  <span className="text-xs font-normal text-ink-3">/mo</span>
                </span>
                {isTrial && !addonEligibleOnTrial(plan.key) ? (
                  <span className="text-[11px] text-ink-3">
                    Not available on trial
                  </span>
                ) : (
                  <button
                    onClick={() => toggleAddon(plan.key, !plan.enabled)}
                    disabled={
                      busyKey === plan.key ||
                      (isTrial && !plan.enabled && !addonEligibleOnTrial(plan.key))
                    }
                    className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-line disabled:opacity-50"
                  >
                    {busyKey === plan.key ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : plan.enabled ? (
                      <ToggleRight size={14} className="text-ink" />
                    ) : (
                      <ToggleLeft size={14} />
                    )}
                    {plan.enabled ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel subscription"
          description={cancelConfirmMessage()}
          confirmLabel="Confirm"
          onConfirm={() => void cancelSubscription()}
          onCancel={() => setConfirmCancel(false)}
        />
      )}
    </div>
  )
}
