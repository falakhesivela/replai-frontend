'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Dialog, Field, Input, Switch } from '@/components/ui'
import { useToast } from '@/components/toast'
import {
  createMyOrder,
  getMyPaymentAccount,
  getMyProducts,
  type TokenGetter,
} from '@/lib/api'
import { formatMoney } from '@/lib/format'
import type {
  FulfillmentMethod,
  ManualOrderInput,
  ManualOrderPaymentMode,
  Order,
  Product,
} from '@/lib/types'
import { OrderItemsEditor, type DraftItem } from './order-items-editor'

const PAYMENT_OPTIONS: Array<{
  value: ManualOrderPaymentMode
  label: string
  hint: string
  needsPaystack?: boolean
}> = [
  { value: 'none', label: 'No payment needed', hint: 'Record the order without collecting payment.' },
  { value: 'paid', label: 'Already paid', hint: 'Cash / EFT / card taken in person.' },
  {
    value: 'link',
    label: 'Send Paystack link',
    hint: 'Generate an online payment link for the customer.',
    needsPaystack: true,
  },
]

export default function NewOrderDialog({
  open,
  token,
  onClose,
  onCreated,
}: {
  open: boolean
  token: TokenGetter
  onClose: () => void
  onCreated: (order: Order) => void
}) {
  const { toast } = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [paymentsActive, setPaymentsActive] = useState(false)

  const [items, setItems] = useState<DraftItem[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMode, setPaymentMode] = useState<ManualOrderPaymentMode>('none')
  const [notifyCustomer, setNotifyCustomer] = useState(false)
  const [fulfillment, setFulfillment] = useState<FulfillmentMethod>('none')
  const [address, setAddress] = useState('')
  const [discount, setDiscount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    // Reset on open.
    setItems([])
    setName('')
    setPhone('')
    setEmail('')
    setNotes('')
    setPaymentMode('none')
    setNotifyCustomer(false)
    setFulfillment('none')
    setAddress('')
    setDiscount('')
    getMyProducts(token).then(setProducts).catch(() => {})
    getMyPaymentAccount(token)
      .then((acct) => setPaymentsActive(acct.status === 'active'))
      .catch(() => setPaymentsActive(false))
  }, [open, token])

  const currency = useMemo(() => {
    const firstProduct = items.find((i) => i.product_id)
    if (firstProduct) {
      const p = products.find((pr) => pr.id === firstProduct.product_id)
      if (p?.currency) return p.currency
    }
    return products[0]?.currency || 'ZAR'
  }, [items, products])

  const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0)
  const discountValue = Math.min(Math.max(parseFloat(discount) || 0, 0), subtotal)
  const total = subtotal - discountValue
  const hasCustomer = name.trim() !== '' || phone.trim() !== ''
  const linkNeedsContact =
    paymentMode === 'link' && phone.trim() === '' && email.trim() === ''
  const deliveryNeedsAddress = fulfillment === 'delivery' && address.trim() === ''
  const canSubmit =
    items.length > 0 && hasCustomer && !linkNeedsContact && !deliveryNeedsAddress && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    const input: ManualOrderInput = {
      customer_name: name.trim() || undefined,
      customer_phone: phone.trim() || undefined,
      customer_email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      payment_mode: paymentMode,
      notify_customer: notifyCustomer,
      fulfillment_method: fulfillment,
      delivery_address: fulfillment === 'delivery' ? address.trim() : undefined,
      discount_amount: discountValue > 0 ? discountValue : undefined,
      items: items.map((it) =>
        it.product_id
          ? { product_id: it.product_id, quantity: it.quantity }
          : { name: it.name, price: it.price, quantity: it.quantity }
      ),
    }
    try {
      const order = await createMyOrder(token, input)
      toast.success('Order created')
      onCreated(order)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create order')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New order" width="max-w-lg">
      <div className="mt-4 max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        {/* Items */}
        <section className="space-y-2">
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">Items</h5>
          <OrderItemsEditor
            products={products}
            items={items}
            currency={currency}
            onChange={setItems}
          />
        </section>

        {/* Customer */}
        <section className="space-y-3">
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">Customer</h5>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" htmlFor="mo-name">
              <Input id="mo-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
            </Field>
            <Field label="Phone" htmlFor="mo-phone">
              <Input id="mo-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="27821234567" inputMode="tel" />
            </Field>
          </div>
          <Field
            label="Email"
            htmlFor="mo-email"
            help="Optional — used for the order confirmation email."
          >
            <Input id="mo-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" type="email" />
          </Field>
          {!hasCustomer && (
            <p className="text-xs text-ink-3">Enter at least a name or a phone number.</p>
          )}
        </section>

        {/* Fulfillment */}
        <section className="space-y-2">
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">Fulfillment</h5>
          <div className="grid grid-cols-3 gap-1.5">
            {(['none', 'pickup', 'delivery'] as FulfillmentMethod[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFulfillment(f)}
                className={`rounded-md border px-3 py-2 text-xs font-medium capitalize transition-colors ${
                  fulfillment === f
                    ? 'border-accent bg-accent text-on-solid'
                    : 'border-line text-ink-2 hover:bg-surface-2'
                }`}
              >
                {f === 'none' ? 'In store' : f}
              </button>
            ))}
          </div>
          {fulfillment === 'delivery' && (
            <Field label="Delivery address" required htmlFor="mo-address">
              <textarea
                id="mo-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder="Street, suburb, city"
                className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </Field>
          )}
        </section>

        {/* Payment */}
        <section className="space-y-2">
          <h5 className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">Payment</h5>
          <div className="space-y-1.5">
            {PAYMENT_OPTIONS.map((opt) => {
              const disabled = opt.needsPaystack && !paymentsActive
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                    paymentMode === opt.value
                      ? 'border-accent bg-accent-soft'
                      : 'border-line hover:bg-surface-2'
                  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <input
                    type="radio"
                    name="payment-mode"
                    className="mt-0.5 accent-accent"
                    checked={paymentMode === opt.value}
                    disabled={disabled}
                    onChange={() => setPaymentMode(opt.value)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{opt.label}</span>
                    <span className="block text-xs text-ink-3">
                      {disabled ? 'Connect Paystack to enable this.' : opt.hint}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
          {linkNeedsContact && (
            <p className="text-xs text-danger">A phone number or email is required to send a payment link.</p>
          )}
          <Field label="Discount" htmlFor="mo-discount" help="Flat amount off the subtotal.">
            <Input
              id="mo-discount"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="w-32"
            />
          </Field>
        </section>

        {/* Notes */}
        <Field label="Notes" htmlFor="mo-notes" help="Internal — not shown to the customer.">
          <textarea
            id="mo-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Collecting Friday afternoon"
            className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </Field>

        {/* Notify */}
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Notify customer on WhatsApp</p>
            <p className="text-xs text-ink-3">
              {phone.trim() ? 'Send an order confirmation message.' : 'Requires a phone number.'}
            </p>
          </div>
          <Switch
            checked={notifyCustomer && phone.trim() !== ''}
            disabled={phone.trim() === ''}
            onChange={setNotifyCustomer}
            aria-label="Notify customer on WhatsApp"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <span className="text-sm text-ink-2">
          {discountValue > 0 && (
            <span className="mr-2 text-xs text-ink-3">
              {formatMoney(subtotal, currency)} − {formatMoney(discountValue, currency)} =
            </span>
          )}
          Total <span className="font-semibold text-ink">{formatMoney(total, currency)}</span>
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Create order
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
