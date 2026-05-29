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
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'

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
      const [acct, bankList] = await Promise.all([
        getMyPaymentAccount(getFreshToken),
        canManage ? getSettlementBanks(getFreshToken).catch(() => [] as SettlementBank[]) : Promise.resolve([]),
      ])
      setAccount(acct)
      setBanks(bankList)
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
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={14} />
          Integrations
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Paystack</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customer payments for WhatsApp orders and paid bookings. Settlements go to your
          business bank account — separate from your Replai subscription.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100">
                <CreditCard size={18} className="text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">Connection status</p>
                {isActive ? (
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p className="inline-flex items-center gap-1.5 text-green-700">
                      <CheckCircle2 size={14} />
                      Connected
                    </p>
                    {account?.business_name && (
                      <p>
                        <span className="text-gray-400">Business:</span> {account.business_name}
                      </p>
                    )}
                    {account?.account_number_last4 && (
                      <p>
                        <span className="text-gray-400">Account:</span> ••••{account.account_number_last4}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
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
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Connect account</h2>
              <form onSubmit={handleConnect} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Business name</label>
                  <input
                    type="text"
                    required
                    value={business_name}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Settlement bank</label>
                  <select
                    required
                    value={settlement_bank}
                    onChange={(e) => setSettlementBank(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select bank…</option>
                    {banks.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Account number</label>
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contact email</label>
                  <input
                    type="email"
                    required
                    value={primary_contact_email}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contact name (optional)</label>
                  <input
                    type="text"
                    value={primary_contact_name}
                    onChange={(e) => setContactName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contact phone (optional)</label>
                  <input
                    type="tel"
                    value={primary_contact_phone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={connecting || !settlement_bank}
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
            <p className="text-sm text-gray-500">
              Only the workspace owner can connect integrations.
            </p>
          )}
        </>
      )}
    </div>
  )
}
