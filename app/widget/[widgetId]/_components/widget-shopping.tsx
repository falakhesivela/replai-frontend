'use client'

import { Loader2, Package, ShoppingBag } from 'lucide-react'
import { CommerceConfirmationReference } from '@/components/commerce-confirmation-reference'
import type {
  WidgetAction,
  WidgetComponent,
  WidgetProductGridItem,
} from '@/lib/api'

export function formatWidgetMoney(currency: string, amount: number): string {
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency || 'ZAR',
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export type CartSummaryData = Extract<WidgetComponent, { type: 'cart_summary' }>

export function extractCartFromComponents(
  components?: WidgetComponent[],
): CartSummaryData | null {
  if (!components?.length) return null
  const cart = components.find((c) => c.type === 'cart_summary')
  return cart ?? null
}

export function inlineShoppingComponents(
  components?: WidgetComponent[],
): WidgetComponent[] {
  if (!components?.length) return []
  return components.filter(
    (c) =>
      c.type === 'product_grid' ||
      c.type === 'cart_summary' ||
      c.type === 'payment_cta' ||
      (c.type === 'actions' && c.actions.length > 0),
  )
}

export function CartDetailCard({
  cart,
  brandColor,
  onBrand,
  onCheckout,
  checkoutBusy,
}: {
  cart: CartSummaryData
  brandColor: string
  onBrand: string
  onCheckout?: () => void
  checkoutBusy?: boolean
}) {
  if (!cart.items.length) return null
  return (
    <div className="mt-2 max-w-[95%] rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
        Your cart
      </p>
      <ul className="mt-2 divide-y divide-gray-100">
        {cart.items.map((line) => (
          <li
            key={line.product_id}
            className="flex items-start justify-between gap-2 py-2 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{line.name}</p>
              <p className="text-xs text-gray-500">
                Qty {line.quantity} × {formatWidgetMoney(cart.currency, line.price)}
              </p>
            </div>
            <p className="shrink-0 text-sm font-medium text-gray-800">
              {formatWidgetMoney(cart.currency, line.line_total)}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
        <span className="text-sm font-semibold text-gray-900">Total</span>
        <span className="text-sm font-bold text-gray-900">
          {formatWidgetMoney(cart.currency, cart.total)}
        </span>
      </div>
      {onCheckout && (
        <button
          type="button"
          disabled={checkoutBusy}
          onClick={onCheckout}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ backgroundColor: brandColor, color: onBrand }}
        >
          {checkoutBusy ? <Loader2 size={16} className="animate-spin" /> : null}
          Checkout
        </button>
      )}
    </div>
  )
}

export function ProductGrid({
  products,
  brandColor,
  onBrand,
  disabled,
  onAdd,
}: {
  products: WidgetProductGridItem[]
  brandColor: string
  onBrand: string
  disabled: boolean
  onAdd: (productId: string, name: string) => void
}) {
  if (!products.length) return null

  return (
    <div className="mt-2 max-w-[95%] space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 pl-0.5">
        Products
      </p>
      <div className="grid gap-2">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex gap-3 rounded-xl border border-gray-100 bg-white p-2.5 shadow-sm"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package size={22} className="text-gray-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
              {p.description && (
                <p className="line-clamp-2 text-xs text-gray-500">{p.description}</p>
              )}
              <p className="text-sm text-gray-600">
                {formatWidgetMoney(p.currency, p.price)}
              </p>
              {!p.in_stock ? (
                <p className="mt-0.5 text-xs text-red-500">Out of stock</p>
              ) : p.stock_left != null ? (
                <p className="mt-0.5 text-xs text-amber-600">Only {p.stock_left} left</p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={disabled || !p.in_stock}
              onClick={() => onAdd(p.id, p.name)}
              className="shrink-0 self-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: brandColor, color: onBrand }}
            >
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PaymentCtaCard({
  url,
  amount,
  currency,
  orderId,
  brandColor,
  onBrand,
}: {
  url?: string | null
  amount: number
  currency: string
  orderId: string
  brandColor: string
  onBrand: string
}) {
  return (
    <div className="mt-2 max-w-[95%] rounded-xl border border-emerald-100 bg-emerald-50/80 p-3 shadow-sm">
      <p className="text-sm font-medium text-gray-900">Order placed</p>
      {orderId && (
        <CommerceConfirmationReference
          id={orderId}
          kind="order"
          arrivalHint="Show this QR code or reference when you collect your order"
        />
      )}
      <p className="mt-1 text-sm text-gray-700">
        Total: {formatWidgetMoney(currency, amount)}
      </p>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold no-underline transition-opacity hover:opacity-90"
          style={{ backgroundColor: brandColor, color: onBrand }}
        >
          <ShoppingBag size={16} />
          Pay now
        </a>
      ) : (
        <p className="mt-2 text-xs text-gray-600">
          The business will confirm payment with you separately.
        </p>
      )}
    </div>
  )
}

export function ActionButtonsRow({
  actions,
  brandColor,
  onBrand,
  disabled,
  onAction,
}: {
  actions: { id: string; label: string; variant?: 'primary' | 'secondary' }[]
  brandColor: string
  onBrand: string
  disabled: boolean
  onAction: (actionId: string, label: string) => void
}) {
  if (!actions.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 max-w-[95%]">
      {actions.map((a) => {
        const primary = a.variant === 'primary'
        return (
          <button
            key={a.id}
            type="button"
            disabled={disabled}
            onClick={() => onAction(a.id, a.label)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-50"
            style={
              primary
                ? { backgroundColor: brandColor, color: onBrand }
                : {
                    borderWidth: 1,
                    borderColor: rgba(brandColor, 0.35),
                    backgroundColor: 'white',
                    color: '#1f2937',
                  }
            }
          >
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

function rgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return `rgba(99, 102, 241, ${alpha})`
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export function StickyCartBar({
  cart,
  brandColor,
  onBrand,
  disabled,
  busy,
  onCheckout,
  onViewCart,
}: {
  cart: CartSummaryData
  brandColor: string
  onBrand: string
  disabled: boolean
  busy: boolean
  onCheckout: () => void
  onViewCart: () => void
}) {
  const count = cart.items.reduce((n, i) => n + i.quantity, 0)
  return (
    <div className="shrink-0 border-t border-gray-200 bg-white px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onViewCart}
          disabled={disabled || busy}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-xs font-medium text-gray-500">
            {count} item{count === 1 ? '' : 's'} in cart
          </p>
          <p className="text-sm font-semibold text-gray-900">
            {formatWidgetMoney(cart.currency, cart.total)}
          </p>
        </button>
        <button
          type="button"
          onClick={onCheckout}
          disabled={disabled || busy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ backgroundColor: brandColor, color: onBrand }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          Checkout
        </button>
      </div>
    </div>
  )
}

export function WidgetMessageComponents({
  components,
  brandColor,
  onBrand,
  disabled,
  addDisabled,
  hasStickyCart,
  onAddProduct,
  onActionId,
  onCheckoutCart,
  checkoutBusy,
}: {
  components: WidgetComponent[]
  brandColor: string
  onBrand: string
  disabled: boolean
  /** When false, Add buttons stay enabled while checkout/booking actions may still be disabled. */
  addDisabled?: boolean
  hasStickyCart: boolean
  onAddProduct: (productId: string, name: string) => void
  onActionId: (actionId: string, label: string) => void
  onCheckoutCart?: () => void
  checkoutBusy?: boolean
}) {
  const gridDisabled = addDisabled ?? disabled
  return (
    <>
      {components.map((comp, idx) => {
        if (comp.type === 'product_grid') {
          return (
            <ProductGrid
              key={`grid-${idx}`}
              products={comp.products}
              brandColor={brandColor}
              onBrand={onBrand}
              disabled={gridDisabled}
              onAdd={onAddProduct}
            />
          )
        }
        if (comp.type === 'cart_summary') {
          return (
            <CartDetailCard
              key={`cart-${idx}`}
              cart={comp}
              brandColor={brandColor}
              onBrand={onBrand}
              onCheckout={onCheckoutCart}
              checkoutBusy={checkoutBusy}
            />
          )
        }
        if (comp.type === 'payment_cta') {
          return (
            <PaymentCtaCard
              key={`pay-${idx}`}
              url={comp.url}
              amount={comp.amount}
              currency={comp.currency}
              orderId={comp.order_id}
              brandColor={brandColor}
              onBrand={onBrand}
            />
          )
        }
        if (comp.type === 'actions') {
          const actions = hasStickyCart
            ? comp.actions.filter(
                (a) => a.id !== 'checkout' && a.id !== 'view_cart',
              )
            : comp.actions
          if (!actions.length) return null
          return (
            <ActionButtonsRow
              key={`act-${idx}`}
              actions={actions}
              brandColor={brandColor}
              onBrand={onBrand}
              disabled={disabled}
              onAction={onActionId}
            />
          )
        }
        return null
      })}
    </>
  )
}

export function actionToWidgetAction(actionId: string): WidgetAction | null {
  if (actionId === 'checkout') return { type: 'checkout' }
  if (actionId === 'view_cart') return { type: 'view_cart' }
  return null
}

export function actionUserLabel(action: WidgetAction, productName?: string): string {
  switch (action.type) {
    case 'add_to_cart':
      return productName ? `Add ${productName}` : 'Add to cart'
    case 'checkout':
      return 'Checkout'
    case 'view_cart':
      return 'View cart'
    default:
      return ''
  }
}
