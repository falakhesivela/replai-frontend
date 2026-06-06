'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, CheckCircle2, ChevronRight, CreditCard, Loader2, Plug } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { getMyCalendarStatus, getMyPaymentAccount, type TokenGetter } from '@/lib/api'
import type { CalendarConnectionStatus, PaymentAccountStatus } from '@/lib/types'
import { Card } from '@/components/ui'

const getFreshToken: TokenGetter = async () => {
  const supabase = createSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

type IntegrationCard = {
  id: string
  name: string
  description: string
  href: string
  icon: typeof CreditCard
  status: 'connected' | 'available' | 'coming_soon'
  statusLabel?: string
}

export default function IntegrationsView() {
  const [paystack, setPaystack] = useState<PaymentAccountStatus | null>(null)
  const [calendar, setCalendar] = useState<CalendarConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pay, cal] = await Promise.allSettled([
        getMyPaymentAccount(getFreshToken),
        getMyCalendarStatus(getFreshToken),
      ])
      setPaystack(pay.status === 'fulfilled' ? pay.value : null)
      setCalendar(cal.status === 'fulfilled' ? cal.value : null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const paystackConnected = paystack?.status === 'active'
  const calendarConnected = calendar?.connected === true

  const integrations: IntegrationCard[] = [
    {
      id: 'paystack',
      name: 'Paystack',
      description:
        'Accept card and bank payments from customers for WhatsApp orders and paid bookings.',
      href: '/portal/integrations/paystack',
      icon: CreditCard,
      status: paystackConnected ? 'connected' : paystack?.paystack_configured ? 'available' : 'available',
      statusLabel: paystackConnected
        ? 'Connected'
        : paystack?.paystack_configured
          ? 'Not connected'
          : 'Unavailable',
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description:
        'Sync confirmed bookings to your team’s Google Calendars — one event per booking.',
      href: '/portal/integrations/google-calendar',
      icon: Calendar,
      status: calendarConnected ? 'connected' : 'available',
      statusLabel: calendarConnected ? 'Connected' : 'Not connected',
    },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100">
            <Plug size={18} className="text-gray-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Integrations</h1>
            <p className="text-sm text-gray-500">
              Connect third-party services to extend your Replai workspace.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <ul className="space-y-3">
          {integrations.map((item) => {
            const Icon = item.icon
            const isLink = item.status !== 'coming_soon'
            const inner = (
              <Card className="p-0 overflow-hidden transition-colors hover:border-gray-300">
                <div className="flex items-center gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Icon size={20} className="text-gray-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      {item.status === 'connected' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-green-200">
                          <CheckCircle2 size={10} />
                          {item.statusLabel ?? 'Connected'}
                        </span>
                      )}
                      {item.status === 'available' && item.statusLabel && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                          {item.statusLabel}
                        </span>
                      )}
                      {item.status === 'coming_soon' && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{item.description}</p>
                  </div>
                  {isLink && (
                    <ChevronRight size={18} className="shrink-0 text-gray-300" />
                  )}
                </div>
              </Card>
            )
            return (
              <li key={item.id}>
                {isLink ? (
                  <Link href={item.href} className="block group">
                    {inner}
                  </Link>
                ) : (
                  <div className="opacity-60 cursor-not-allowed">{inner}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-gray-400">
        Your Replai subscription is billed separately via Paddle under{' '}
        <Link href="/portal/subscription" className="text-gray-500 hover:text-gray-700 underline">
          Subscription
        </Link>
        .
      </p>
    </div>
  )
}
