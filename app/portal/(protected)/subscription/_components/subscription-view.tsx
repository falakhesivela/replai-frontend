'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, CreditCard, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getMySubscription,
  toggleMyFeature,
  PortalAuthError,
  type TokenGetter,
} from '@/lib/api'
import type { Plan, ClientSubscription } from '@/lib/types'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount)
}

function PlanCard({
  plan,
  onToggle,
  toggling,
}: {
  plan: Plan
  onToggle: (key: string, enabled: boolean) => void
  toggling: boolean
}) {
  const isBase = plan.key === 'base'

  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        plan.enabled
          ? 'border-[#3D6BF8] bg-indigo-50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
            {isBase && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                Included
              </span>
            )}
            {plan.enabled && !isBase && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 uppercase tracking-wide">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">{plan.description}</p>
          {plan.enabled && plan.enabled_at && !isBase && (
            <p className="mt-1.5 text-[11px] text-gray-400">
              Enabled {new Date(plan.enabled_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-sm font-semibold text-gray-900">
            {isBase ? fmt(plan.price, plan.currency) : `+${fmt(plan.price, plan.currency)}`}
            <span className="text-xs font-normal text-gray-400">/mo</span>
          </span>

          {!isBase && (
            <button
              onClick={() => onToggle(plan.key, !plan.enabled)}
              disabled={toggling}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50
                bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              {toggling ? (
                <Loader2 size={13} className="animate-spin" />
              ) : plan.enabled ? (
                <ToggleRight size={14} className="text-gray-900" />
              ) : (
                <ToggleLeft size={14} />
              )}
              {plan.enabled ? 'Disable' : 'Enable'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SubscriptionView() {
  const [subscription, setSubscription] = useState<ClientSubscription | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const detail = await getMySubscription(getFreshToken)
      setSubscription(detail.subscription)
      setPlans(detail.plans)
    } catch (err) {
      if (err instanceof PortalAuthError) {
        setError('Session expired. Please refresh the page.')
      } else {
        setError('Failed to load subscription.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(planKey: string, enabled: boolean) {
    setTogglingKey(planKey)
    try {
      const result = await toggleMyFeature(getFreshToken, planKey, enabled)
      setSubscription(result.subscription)
      setPlans((prev) =>
        prev.map((p) =>
          p.key === planKey
            ? { ...p, enabled, enabled_at: enabled ? new Date().toISOString() : null }
            : p
        )
      )
    } catch (err) {
      if (err instanceof PortalAuthError) {
        setError('Session expired. Please refresh the page.')
      } else {
        setError('Failed to update feature. Please try again.')
      }
    } finally {
      setTogglingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  const currency = subscription?.currency ?? 'ZAR'
  const total = subscription?.total_price ?? 0
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-ZA', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your plan and add-ons. Changes take effect immediately.
        </p>
      </div>

      {/* Billing summary card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
              <CreditCard size={16} className="text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Monthly total</p>
              {periodEnd && (
                <p className="text-xs text-gray-400">Next period: {periodEnd}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{fmt(total, currency)}</p>
            <p className="text-xs text-gray-400">/month</p>
          </div>
        </div>

        {/* Mock billing notice */}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
          <CheckCircle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-xs text-amber-700">
            Billing is currently tracked manually. Payment integration coming soon.
          </p>
        </div>
      </div>

      {/* Plan cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-gray-700">Plans & Add-ons</h2>
        {plans.map((plan) => (
          <PlanCard
            key={plan.key}
            plan={plan}
            onToggle={handleToggle}
            toggling={togglingKey === plan.key}
          />
        ))}
      </div>
    </div>
  )
}
