'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react'

type PaymentStatus = 'paid' | 'pending' | 'failed' | 'unknown'

interface StatusResponse {
  kind: 'order' | 'booking'
  reference: string
  payment_status: PaymentStatus
  record_status?: string | null
  amount?: number | null
  currency?: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api-proxy/api'

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency || 'ZAR',
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export default function PaymentCompleteView({ reference: referenceProp }: { reference: string }) {
  const [resolvedRef, setResolvedRef] = useState(referenceProp.trim())
  const [data, setData] = useState<StatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const effectiveRef =
      referenceProp.trim() ||
      params?.get('reference')?.trim() ||
      params?.get('trxref')?.trim() ||
      ''

    setResolvedRef(effectiveRef)

    if (!effectiveRef) {
      setLoading(false)
      return
    }

    let cancelled = false
    let attempts = 0
    const maxAttempts = 15

    async function load() {
      let scheduleRetry = false
      try {
        const res = await fetch(
          `${API_URL}/public/payments/status?reference=${encodeURIComponent(effectiveRef)}`
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail ?? 'Could not confirm payment status')
        }
        const json = (await res.json()) as StatusResponse
        if (cancelled) return

        setData(json)
        setError(null)

        if (json.payment_status === 'pending' && attempts < maxAttempts) {
          attempts += 1
          scheduleRetry = true
          window.setTimeout(load, 2000)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong')
        }
      } finally {
        if (!cancelled && !scheduleRetry) setLoading(false)
      }
    }

    setLoading(true)
    load()
    return () => {
      cancelled = true
    }
  }, [referenceProp])

  const reference = resolvedRef
  const status = data?.payment_status ?? (error ? 'unknown' : 'pending')

  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-6">Replai</p>

        {loading && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-500" />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">Confirming payment…</h1>
            <p className="mt-4 text-sm text-gray-600">
              This usually takes a few seconds. You can close this page and return to WhatsApp.
            </p>
          </>
        )}

        {!loading && !reference && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">Missing payment reference</h1>
            <p className="mt-2 text-sm text-gray-500">
              If you completed a payment, you can close this page and return to WhatsApp — the
              business will confirm your order shortly.
            </p>
          </>
        )}

        {!loading && reference && status === 'paid' && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">Payment successful</h1>
            <p className="mt-2 text-sm text-gray-500">
              {data?.kind === 'booking'
                ? 'Your booking payment was received. The business will confirm your appointment.'
                : 'Your payment was received. The business will confirm your order soon.'}
            </p>
            {data?.amount != null && (
              <p className="mt-3 text-sm font-medium text-gray-800">
                {formatMoney(data.amount, data.currency ?? 'ZAR')}
              </p>
            )}
          </>
        )}

        {!loading && reference && status === 'pending' && !error && (
          <>
            <Clock className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">Payment processing</h1>
            <p className="mt-2 text-sm text-gray-500">
              We are still confirming your payment. You can close this page and return to WhatsApp
              — the business will be notified once it is confirmed.
            </p>
          </>
        )}

        {!loading && reference && status === 'failed' && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">Payment not completed</h1>
            <p className="mt-2 text-sm text-gray-500">
              This payment did not go through. Return to WhatsApp and ask for a new payment link.
            </p>
          </>
        )}

        {!loading && error && (
          <>
            <Clock className="mx-auto h-10 w-10 text-gray-400" />
            <h1 className="mt-4 text-lg font-semibold text-gray-900">Thank you</h1>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <p className="mt-3 text-xs text-gray-400">
              If you were charged, the business will still see your payment once processing
              finishes. You can close this page and return to WhatsApp.
            </p>
          </>
        )}

        <p className="mt-8 text-xs text-gray-400">
          You can safely close this tab and continue in WhatsApp.
        </p>
      </div>
    </main>
  )
}
