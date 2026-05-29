'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Loader2, Package, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  createMyProduct,
  deleteMyProduct,
  getMyProducts,
  importMyProducts,
  updateMyProduct,
  PortalAuthError,
  type ProductImportResult,
  type TokenGetter,
} from '@/lib/api'
import type { Product } from '@/lib/types'
import type { PortalRole } from '@/lib/portal-permissions'
import { Card } from '@/components/ui'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function fmt(amount: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount)
}

const EMPTY_FORM = {
  name: '',
  description: '',
  price: '',
  stock_quantity: '',
  category: '',
  image_url: '',
  is_active: true,
}

type FormState = typeof EMPTY_FORM

interface ProductFormProps {
  initial?: Product | null
  onSave: (data: FormState) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function ProductForm({ initial, onSave, onCancel, saving }: ProductFormProps) {
  const [form, setForm] = useState<FormState>({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    price: initial?.price?.toString() ?? '',
    stock_quantity: initial?.stock_quantity?.toString() ?? '',
    category: initial?.category ?? '',
    image_url: initial?.image_url ?? '',
    is_active: initial?.is_active ?? true,
  })

  function set(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Product name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Wireless Earbuds"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Price (ZAR) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            placeholder="0.00"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Stock quantity <span className="text-gray-400">(-1 = unlimited)</span>
          </label>
          <input
            type="number"
            min="-1"
            value={form.stock_quantity}
            onChange={(e) => set('stock_quantity', e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            placeholder="e.g. Electronics"
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Image URL</label>
          <input
            type="url"
            value={form.image_url}
            onChange={(e) => set('image_url', e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Brief product description..."
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <input
            id="is_active"
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set('is_active', e.target.checked)}
            className="rounded border-gray-300 text-gray-900"
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">Active (visible to AI)</label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim() || !form.price}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={13} className="animate-spin" />}
          {initial ? 'Save changes' : 'Add product'}
        </button>
      </div>
    </div>
  )
}

export default function ProductsView({ role }: { role: PortalRole }) {
  const canEdit = role === 'owner' || role === 'manager'

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ProductImportResult | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyProducts(getFreshToken)
      setProducts(data)
    } catch (err) {
      if (err instanceof PortalAuthError && err.status === 403) {
        setError('E-Commerce addon is not enabled. Enable it from your Subscription page.')
      } else {
        setError('Failed to load products.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(form: FormState) {
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        stock_quantity: form.stock_quantity !== '' ? parseInt(form.stock_quantity, 10) : -1,
        category: form.category.trim() || null,
        image_url: form.image_url.trim() || null,
        is_active: form.is_active,
        currency: 'ZAR',
      }

      if (editingProduct) {
        const updated = await updateMyProduct(getFreshToken, editingProduct.id, payload)
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      } else {
        const created = await createMyProduct(getFreshToken, payload)
        setProducts((prev) => [created, ...prev])
      }
      setShowForm(false)
      setEditingProduct(null)
    } catch {
      setFormError('Failed to save product. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    setDeletingId(product.id)
    try {
      await deleteMyProduct(getFreshToken, product.id)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
    } catch {
      alert('Failed to delete product.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportResult(null)
    try {
      const result = await importMyProducts(getFreshToken, file)
      setImportResult(result)
      if (result.created > 0) await load()
    } catch {
      setImportResult({ created: 0, failed: 1, errors: ['Upload failed. Please try again.'] })
    } finally {
      setImporting(false)
    }
  }

  function downloadTemplate() {
    const header = 'name,description,price,stock_quantity,category,image_url,is_active'
    const example = 'Example Product,A short description,99.99,10,Electronics,,true'
    const blob = new Blob([header + '\n' + example], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'products-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setShowForm(true)
    setFormError(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditingProduct(null)
    setFormError(null)
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Products</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Products your AI can present and sell via WhatsApp.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImport}
            />
            <button
              onClick={downloadTemplate}
              title="Download CSV template"
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download size={14} />
              Template
            </button>
            <button
              onClick={() => csvInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Import CSV
            </button>
            {!showForm && (
              <button
                onClick={() => { setShowForm(true); setEditingProduct(null); setFormError(null) }}
                className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
              >
                <Plus size={14} />
                Add product
              </button>
            )}
          </div>
        )}
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          importResult.failed === 0
            ? 'border-green-200 bg-green-50 text-green-800'
            : importResult.created === 0
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-yellow-200 bg-yellow-50 text-yellow-800'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {importResult.created} product{importResult.created !== 1 ? 's' : ''} imported
                {importResult.failed > 0 && `, ${importResult.failed} failed`}
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs opacity-80">
                  {importResult.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                  {importResult.errors.length > 5 && (
                    <li>• …and {importResult.errors.length - 5} more</li>
                  )}
                </ul>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Form panel */}
      {showForm && canEdit && (
        <Card padding="sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-900">
              {editingProduct ? 'Edit product' : 'New product'}
            </h2>
            <button onClick={closeForm} className="rounded-md p-1 text-gray-400 hover:text-gray-700">
              <X size={15} />
            </button>
          </div>
          {formError && (
            <p className="mb-3 text-xs text-red-600">{formError}</p>
          )}
          <ProductForm
            initial={editingProduct}
            onSave={handleSave}
            onCancel={closeForm}
            saving={saving}
          />
        </Card>
      )}

      {/* Product list */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-16 text-center">
          <Package size={32} className="mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No products yet</p>
          <p className="mt-1 text-xs text-gray-400">
            Add your first product and your AI will be able to sell it via WhatsApp.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 hidden sm:table-cell">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-[180px]">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-gray-400 truncate max-w-[180px]">{product.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {product.category ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {fmt(product.price)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                    {product.stock_quantity === -1 ? '∞' : product.stock_quantity}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      product.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {product.is_active ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(product)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          disabled={deletingId === product.id}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === product.id
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
