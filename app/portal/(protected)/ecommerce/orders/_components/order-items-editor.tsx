'use client'

import { useMemo, useState } from 'react'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui'
import { formatMoney } from '@/lib/format'
import type { Product } from '@/lib/types'

/** A working line in the editor. Product lines carry product_id; custom lines don't. */
export interface DraftItem {
  product_id: string | null
  name: string
  price: number
  quantity: number
  /** Stock cap for product lines (-1 = unlimited, undefined for custom). */
  stock?: number
}

/** Convert order items already on a record into editable drafts. */
export function itemsToDrafts(
  items: { product_id: string | null; name: string; price: number; quantity: number }[],
  products: Product[]
): DraftItem[] {
  const byId = new Map(products.map((p) => [p.id, p]))
  return items.map((it) => ({
    product_id: it.product_id,
    name: it.name,
    price: it.price,
    quantity: it.quantity,
    stock: it.product_id ? byId.get(it.product_id)?.stock_quantity : undefined,
  }))
}

function QtyStepper({
  value,
  max,
  onChange,
}: {
  value: number
  max?: number
  onChange: (v: number) => void
}) {
  const atMax = max !== undefined && max !== -1 && value >= max
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        <Minus size={13} />
      </button>
      <span className="w-7 text-center text-sm tabular-nums text-ink">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-2 hover:bg-surface-2 disabled:opacity-40"
        disabled={atMax}
        aria-label="Increase quantity"
      >
        <Plus size={13} />
      </button>
    </div>
  )
}

export function OrderItemsEditor({
  products,
  items,
  currency,
  onChange,
}: {
  products: Product[]
  items: DraftItem[]
  currency: string
  onChange: (items: DraftItem[]) => void
}) {
  const [search, setSearch] = useState('')
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')

  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    const active = products.filter((p) => p.is_active)
    if (!q) return active.slice(0, 8)
    return active
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [products, search])

  function addProduct(p: Product) {
    const existing = items.find((i) => i.product_id === p.id)
    if (existing) {
      onChange(
        items.map((i) =>
          i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      )
    } else {
      onChange([
        ...items,
        {
          product_id: p.id,
          name: p.name,
          price: p.price,
          quantity: 1,
          stock: p.stock_quantity,
        },
      ])
    }
    setSearch('')
  }

  function addCustom() {
    const name = customName.trim()
    const price = parseFloat(customPrice)
    if (!name || Number.isNaN(price) || price < 0) return
    onChange([...items, { product_id: null, name, price, quantity: 1 }])
    setCustomName('')
    setCustomPrice('')
  }

  function updateQty(index: number, qty: number) {
    onChange(items.map((it, i) => (i === index ? { ...it, quantity: qty } : it)))
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  const total = items.reduce((sum, it) => sum + it.price * it.quantity, 0)

  return (
    <div className="space-y-3">
      {/* Product search */}
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products to add…"
          className="pl-9"
        />
        {search.trim() && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-overlay shadow-overlay">
            {results.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-ink-3">No matching products.</p>
            ) : (
              results.map((p) => {
                const out = p.stock_quantity === 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={out}
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-2 disabled:opacity-40"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
                    <span className="shrink-0 text-xs text-ink-3">
                      {out ? 'Out of stock' : formatMoney(p.price, p.currency || currency)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Custom line item */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Custom item name"
          />
        </div>
        <div className="w-24">
          <Input
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            placeholder="Price"
            inputMode="decimal"
          />
        </div>
        <button
          type="button"
          onClick={addCustom}
          disabled={!customName.trim() || customPrice.trim() === ''}
          className="flex h-9 items-center gap-1 rounded-md border border-line px-3 text-xs font-medium text-ink-2 hover:bg-surface-2 disabled:opacity-40"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {/* Selected lines */}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-ink-3">
          No items yet. Search products above or add a custom line.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line">
          {items.map((it, i) => (
            <div
              key={`${it.product_id ?? 'custom'}-${i}`}
              className="flex items-center gap-3 border-b border-line/60 px-3 py-2.5 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  {it.name}
                  {it.product_id === null && (
                    <span className="ml-1.5 rounded bg-surface-2 px-1 py-0.5 text-[9px] uppercase tracking-wide text-ink-3">
                      custom
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-3">{formatMoney(it.price, currency)} each</p>
              </div>
              <QtyStepper value={it.quantity} max={it.stock} onChange={(v) => updateQty(i, v)} />
              <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums text-ink">
                {formatMoney(it.price * it.quantity, currency)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="rounded-md p-1 text-ink-3 hover:bg-danger-soft hover:text-danger"
                aria-label={`Remove ${it.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between bg-surface-2 px-3 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-2">Total</span>
            <span className="text-sm font-bold tabular-nums text-ink">
              {formatMoney(total, currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
