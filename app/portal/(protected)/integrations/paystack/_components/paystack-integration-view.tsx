'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  connectPaystackSubaccount,
  getMyPaymentAccount,
  getSettlementBanks,
  type TokenGetter,
} from '@/lib/api'
import type { PaymentAccountStatus, SettlementBank } from '@/lib/types'
import { useToast } from '@/components/toast'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, buttonClasses } from '@/components/ui'

const getFreshToken: TokenGetter = async () => {
  const supabase = createSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

const inputClass =
  'w-full rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25'

export default function PaystackIntegrationView({
  ownerEmail,
  businessName,
}: {
  ownerEmail: string
  businessName: string
}) {
  const { toast } = useToast()
  const { can } = usePermissions()
  const canManage = can('manage_billing')

  const [account, setAccount] = useState<PaymentAccountStatus | null>(null)
  const [banks, setBanks] = useState<SettlementBank[]>([])
  const [banksError, setBanksError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const [business_name, setBusinessName] = useState(businessName)
  const [settlement_bank, setSettlementBank] = useState('')
  const [account_number, setAccountNumber] = useState('')
  const [primary_contact_email, setContactEmail] = useState(ownerEmail)
  const [primary_contact_name, setContactName] = useState('')
  const [primary_contact_phone, setContactPhone] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const acct = await getMyPaymentAccount(getFreshToken)
      setAccount(acct)
      setBanksError(null)
      if (canManage) {
        try {
          setBanks(await getSettlementBanks(getFreshToken))
        } catch (err) {
          setBanks([])
          setBanksError(
            err instanceof Error
              ? err.message
              : 'Could not load banks from Paystack. Check server PAYSTACK_SECRET_KEY and redeploy.'
          )
        }
      } else {
        setBanks([])
      }
    } catch {
      toast.error('Could not load Paystack integration.')
    } finally {
      setLoading(false)
    }
  }, [canManage, toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    if (!canManage) return
    setConnecting(true)
    try {
      const updated = await connectPaystackSubaccount(getFreshToken, {
        business_name: business_name.trim(),
        settlement_bank,
        account_number: account_number.trim(),
        primary_contact_email: primary_contact_email.trim(),
        primary_contact_name: primary_contact_name.trim() || null,
        primary_contact_phone: primary_contact_phone.trim() || null,
      })
      setAccount(updated)
      toast.success('Paystack connected. Customers can now pay online.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect Paystack.')
    } finally {
      setConnecting(false)
    }
  }

  const isActive = account?.status === 'active'

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link
          href="/portal/integrations"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} />
          Integrations
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Paystack</h1>
        <p className="mt-1 text-sm text-ink-2">
          Customer payments for WhatsApp orders and paid bookings. Settlements go to your
          business bank account — separate from your Replai subscription.
        </p>
        <p className="mt-2 text-xs text-ink-3">
          In Paystack, set <strong className="font-medium text-ink-2">Test callback URL</strong>{' '}
          to your public page: <code className="text-ink-2">/payment/complete</code> on your app
          domain (e.g. https://app.replai.co.za/payment/complete). Customers land there after paying
          — no login required.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
        </div>
      ) : (
        <>
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2">
                <CreditCard size={18} className="text-ink-2" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Connection status</p>
                {isActive ? (
                  <div className="mt-2 space-y-1 text-sm text-ink-2">
                    <p className="inline-flex items-center gap-1.5 text-success">
                      <CheckCircle2 size={14} />
                      Connected
                    </p>
                    {account?.business_name && (
                      <p>
                        <span className="text-ink-3">Business:</span> {account.business_name}
                      </p>
                    )}
                    {account?.account_number_last4 && (
                      <p>
                        <span className="text-ink-3">Account:</span> ••••{account.account_number_last4}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-ink-2">
                    {account?.paystack_configured
                      ? 'Connect your business bank account to receive customer payments.'
                      : 'Online payments are not enabled on this Replai environment yet.'}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {!isActive && account?.paystack_configured && canManage && (
            <Card>
              <h2 className="text-sm font-semibold text-ink mb-4">Connect account</h2>
              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Business name</label>
                  <input
                    type="text"
                    required
                    value={business_name}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Settlement bank</label>
                  {banksError ? (
                    <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning ring-1 ring-warning/25">
                      {banksError}
                    </p>
                  ) : (
                    <select
                      required
                      value={settlement_bank}
                      onChange={(e) => setSettlementBank(e.target.value)}
                      className={inputClass}
                      disabled={banks.length === 0}
                    >
                      <option value="">
                        {banks.length === 0 ? 'Loading banks…' : 'Select bank…'}
                      </option>
                      {banks.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Account number</label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    value={account_number}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Contact email</label>
                  <input
                    type="email"
                    required
                    value={primary_contact_email}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Contact name (optional)</label>
                  <input
                    type="text"
                    value={primary_contact_name}
                    onChange={(e) => setContactName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 mb-1">Contact phone (optional)</label>
                  <input
                    type="tel"
                    value={primary_contact_phone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={connecting || !settlement_bank || !!banksError || banks.length === 0}
                  className={buttonClasses({ variant: 'primary' })}
                >
                  {connecting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    'Connect Paystack'
                  )}
                </button>
              </form>
            </Card>
          )}

          {!canManage && (
            <p className="text-sm text-ink-2">
              Only the workspace owner can connect integrations.
            </p>
          )}
        </>
      )}
    </div>
  )
}
