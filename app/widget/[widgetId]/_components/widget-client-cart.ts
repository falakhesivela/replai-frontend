import type { WidgetProductGridItem } from '@/lib/api'
import type { CartSummaryData } from './widget-shopping'

export function cartStorageKey(widgetId: string, conversationId: string): string {
  return `widget_cart_${widgetId}_${conversationId}`
}

export function loadStoredCart(key: string): CartSummaryData | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CartSummaryData
    if (parsed?.type !== 'cart_summary' || !Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveStoredCart(key: string, cart: CartSummaryData | null): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    if (!cart || cart.items.length === 0) {
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, JSON.stringify(cart))
    }
  } catch {
    // ignore quota errors
  }
}

/** Merge a product into the local cart (instant UI update). */
export function addProductToLocalCart(
  cart: CartSummaryData | null,
  product: WidgetProductGridItem,
  quantity = 1,
): CartSummaryData {
  const currency = product.currency || 'ZAR'
  const price = product.price
  const existing = cart?.items ?? []
  const idx = existing.findIndex((i) => i.product_id === product.id)
  let items = existing
  if (idx >= 0) {
    items = existing.map((line, i) =>
      i === idx
        ? {
            ...line,
            quantity: line.quantity + quantity,
            line_total: (line.quantity + quantity) * line.price,
          }
        : line,
    )
  } else {
    items = [
      ...existing,
      {
        product_id: product.id,
        name: product.name,
        quantity,
        price,
        line_total: price * quantity,
      },
    ]
  }
  const total = items.reduce((sum, i) => sum + i.line_total, 0)
  return { type: 'cart_summary', items, total, currency }
}

export function findProductInMessages(
  messages: { role: string; components?: { type: string; products?: WidgetProductGridItem[] }[] }[],
  productId: string,
): WidgetProductGridItem | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'assistant' || !msg.components) continue
    for (const comp of msg.components) {
      if (comp.type === 'product_grid' && comp.products) {
        const hit = comp.products.find((p) => p.id === productId)
        if (hit) return hit
      }
    }
  }
  return null
}
