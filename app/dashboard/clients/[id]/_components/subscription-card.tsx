'use client'

import { useState } from 'react'
import { CreditCard, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import type { ClientSubscription, Plan, SubscriptionDetail } from '@/lib/types'
import { toggleClientFeatureAction } from '../actions'

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)
}

export default function SubscriptionCard({
  clientId,
  initialDetail,
}: {
  clientId: string
  initialDetail: SubscriptionDetail
}) {
  const [subscription, setSubscription] = useState<ClientSubscription | null>(
    initialDetail.subscription
  )
  const [plans, setPlans] = useState<Plan[]>(initialDetail.plans)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currency = subscription?.currency ?? 'ZAR'

  async function handleToggle(planKey: string, enabled: boolean) {
    setTogglingKey(planKey)
    setError(null)
    const result = await toggleClientFeatureAction(clientId, planKey, enabled)
    if (result.error) {
      setError(result.error)
    } else {
      setSubscription(result.subscription)
      setPlans((prev) =>
        prev.map((p) =>
          p.key === planKey
            ? { ...p, enabled, enabled_at: enabled ? new Date().toISOString() : null }
            : p
        )
      )
    }
    setTogglingKey(null)
  }

  const addons = plans.filter((p) => p.key !== 'base')

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard size={15} strokeWidth={1.75} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Subscription</h3>
        </div>
        {subscription && (
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">
              {fmt(subscription.total_price, currency)}
              <span className="text-xs font-normal text-gray-400">/mo</span>
            </p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              subscription.status === 'active'
                ? 'bg-green-100 text-green-700'
                : subscription.status === 'past_due'
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-400'
            }`}>
              {subscription.status.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-600">{error}</p>
      )}

      {/* Addon toggles */}
      <div className="space-y-2">
        {addons.map((plan) => (
          <div
            key={plan.key}
            className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{plan.name}</p>
              <p className="text-xs text-gray-400">
                +{fmt(plan.price, currency)}/mo
                {plan.enabled && plan.enabled_at && (
                  <span className="ml-2 text-gray-300">
                    since {new Date(plan.enabled_at).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </span>
                )}
              </p>
            </div>

            <button
              onClick={() => handleToggle(plan.key, !plan.enabled)}
              disabled={togglingKey === plan.key}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              title={plan.enabled ? `Disable ${plan.name}` : `Enable ${plan.name}`}
            >
              {togglingKey === plan.key ? (
                <Loader2 size={13} className="animate-spin" />
              ) : plan.enabled ? (
                <ToggleRight size={14} className="text-gray-900" />
              ) : (
                <ToggleLeft size={14} />
              )}
              {plan.enabled ? 'On' : 'Off'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
