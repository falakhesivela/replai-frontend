'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  ImageIcon,
  Loader2,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  createMyProduct,
  deleteMyProduct,
  getMyProducts,
  getMyWhatsAppCatalogStatus,
  importMyProducts,
  updateMyProduct,
  uploadMyProductImage,
  PortalAuthError,
  type ProductImportResult,
  type TokenGetter,
} from '@/lib/api'
import { formatMoney } from '@/lib/format'
import type { Product } from '@/lib/types'
import type { PortalRole } from '@/lib/portal-permissions'
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Switch,
  TableShell,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from '@/components/ui'
import { useToast } from '@/components/toast'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/** Stock badge: out-of-stock (danger), low (warning), unlimited, or a count. */
function StockBadge({ quantity }: { quantity: number }) {
  if (quantity === -1) return <Badge tone="neutral">Unlimited</Badge>
  if (quantity === 0) return <Badge tone="danger">Out of stock</Badge>
  if (quantity <= 5) return <Badge tone="warning">Low · {quantity}</Badge>
  return <span className="text-ink-2 tabular-nums">{quantity}</span>
}

/** Meta catalog sync badge — shown only while a WhatsApp Catalog is connected. */
function SyncBadge({ product }: { product: Product }) {
  switch (product.meta_sync_status) {
    case 'synced':
      return <Badge tone="success">Synced</Badge>
    case 'error':
      return (
        <span title={product.meta_sync_error ?? undefined}>
          <Badge tone="danger">Error</Badge>
        </span>
      )
    case 'skipped':
      return (
        <span title="Meta requires a product image">
          <Badge tone="neutral">No image</Badge>
        </span>
      )
    default:
      return <Badge tone="warning">Pending</Badge>
  }
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

function ProductDialog({
  open,
  initial,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean
  initial: Product | null
  categories: string[]
  onClose: () => void
  onSaved: (product: Product, isNew: boolean) => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      initial
        ? {
            name: initial.name,
            description: initial.description ?? '',
            price: initial.price?.toString() ?? '',
            stock_quantity: initial.stock_quantity?.toString() ?? '',
            category: initial.category ?? '',
            image_url: initial.image_url ?? '',
            is_active: initial.is_active,
          }
        : EMPTY_FORM
    )
  }, [open, initial])

  function set(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const { url } = await uploadMyProductImage(getFreshToken, file)
      set('image_url', url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        stock_quantity: form.stock_quantity !== '' ? parseInt(form.stock_quantity, 10) : -1,
        category: form.category.trim() || null,
        image_url: form.image_url.trim() || null,
        is_active: form.is_active,
        currency: initial?.currency ?? 'ZAR',
      }
      if (initial) {
        const updated = await updateMyProduct(getFreshToken, initial.id, payload)
        onSaved(updated, false)
      } else {
        const created = await createMyProduct(getFreshToken, payload)
        onSaved(created, true)
      }
      onClose()
    } catch {
      setError('Failed to save product. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Edit product' : 'New product'}
      width="max-w-lg"
    >
      <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {/* Image */}
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2">
            {form.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={22} className="text-ink-3" />
            )}
          </div>
          <div className="space-y-1.5">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {form.image_url ? 'Replace image' : 'Upload image'}
            </Button>
            {form.image_url && (
              <button
                type="button"
                onClick={() => set('image_url', '')}
                className="block text-xs text-ink-3 hover:text-danger"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <Field label="Product name" required htmlFor="pf-name">
          <Input id="pf-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Wireless Earbuds" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price" required htmlFor="pf-price">
            <Input id="pf-price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Stock" help="Leave blank for unlimited" htmlFor="pf-stock">
            <Input id="pf-stock" type="number" min="-1" value={form.stock_quantity} onChange={(e) => set('stock_quantity', e.target.value)} placeholder="Unlimited" />
          </Field>
        </div>

        <Field label="Category" htmlFor="pf-cat">
          <Input id="pf-cat" list="product-categories" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Electronics" />
          <datalist id="product-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>

        <Field label="Description" htmlFor="pf-desc">
          <textarea
            id="pf-desc"
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Brief product description…"
            className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-ink">Active</p>
            <p className="text-xs text-ink-3">Visible to the AI and customers</p>
          </div>
          <Switch checked={form.is_active} onChange={(v) => set('is_active', v)} aria-label="Active" />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !form.name.trim() || form.price === ''}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {initial ? 'Save changes' : 'Add product'}
        </Button>
      </div>
    </Dialog>
  )
}

export default function ProductsView({ role }: { role: PortalRole }) {
  const canEdit = role === 'owner' || role === 'manager'
  const { toast } = useToast()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ProductImportResult | null>(null)
  const [catalogActive, setCatalogActive] = useState(false)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])).sort(),
    [products]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProducts(await getMyProducts(getFreshToken))
      // Show sync badges only when a Meta catalog is actively connected.
      try {
        const catalog = await getMyWhatsAppCatalogStatus(getFreshToken)
        setCatalogActive(catalog.status === 'active')
      } catch {
        setCatalogActive(false)
      }
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

  function handleSaved(product: Product, isNew: boolean) {
    setProducts((prev) =>
      isNew ? [product, ...prev] : prev.map((p) => (p.id === product.id ? product : p))
    )
    toast.success(isNew ? 'Product added' : 'Product updated')
  }

  async function handleToggleActive(product: Product) {
    setTogglingId(product.id)
    try {
      const updated = await updateMyProduct(getFreshToken, product.id, { is_active: !product.is_active })
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    } catch {
      toast.error('Failed to update visibility')
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(product: Product) {
    setConfirmDelete(null)
    setDeletingId(product.id)
    try {
      await deleteMyProduct(getFreshToken, product.id)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      toast.success('Product deleted')
    } catch {
      toast.error('Failed to delete product')
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

  function openNew() {
    setEditingProduct(null)
    setDialogOpen(true)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setDialogOpen(true)
  }

  if (error) {
    return <div className="p-6"><p className="text-sm text-danger">{error}</p></div>
  }

  return (
    <div className="mx-auto max-w-5xl">
      <ProductDialog
        open={dialogOpen}
        initial={editingProduct}
        categories={categories}
        onClose={() => setDialogOpen(false)}
        onSaved={handleSaved}
      />

      <PageHeader
        title="Products"
        description="Products your AI can present and sell via WhatsApp and the web widget."
        actions={
          canEdit && (
            <>
              <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
              <Button variant="secondary" size="sm" onClick={downloadTemplate} title="Download CSV template">
                <Download size={14} /> Template
              </Button>
              <Button variant="secondary" size="sm" onClick={() => csvInputRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import CSV
              </Button>
              <Button size="sm" onClick={openNew}>
                <Plus size={14} /> Add product
              </Button>
            </>
          )
        }
      />

      {/* Import result banner */}
      {importResult && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
          importResult.failed === 0
            ? 'border-success/30 bg-success-soft text-success'
            : importResult.created === 0
              ? 'border-danger/30 bg-danger-soft text-danger'
              : 'border-warning/30 bg-warning-soft text-warning'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">
                {importResult.created} product{importResult.created !== 1 ? 's' : ''} imported
                {importResult.failed > 0 && `, ${importResult.failed} failed`}
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 text-xs opacity-80">
                  {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                  {importResult.errors.length > 5 && <li>• …and {importResult.errors.length - 5} more</li>}
                </ul>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Package}
          title="No products yet"
          description="Add your first product and your AI will be able to sell it via WhatsApp."
          action={canEdit && <Button onClick={openNew}><Plus size={15} /> Add product</Button>}
        />
      ) : (
        <TableShell>
          <THead>
            <Th className="text-left">Product</Th>
            <Th className="hidden text-left sm:table-cell">Category</Th>
            <Th className="text-right">Price</Th>
            <Th className="hidden text-right sm:table-cell">Stock</Th>
            {catalogActive && <Th className="hidden text-center sm:table-cell">Catalog</Th>}
            <Th className="text-center">Active</Th>
            {canEdit && <Th />}
          </THead>
          <TBody>
            {products.map((product) => (
              <Tr key={product.id}>
                <Td className="text-ink">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-surface-2">
                      {product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon size={16} className="text-ink-3" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink max-w-50">{product.name}</p>
                      {product.description && (
                        <p className="truncate text-xs text-ink-3 max-w-50">{product.description}</p>
                      )}
                    </div>
                  </div>
                </Td>
                <Td className="hidden sm:table-cell">
                  {product.category ?? <span className="text-ink-3">—</span>}
                </Td>
                <Td className="text-right font-medium text-ink">
                  {formatMoney(product.price, product.currency)}
                </Td>
                <Td className="hidden text-right sm:table-cell">
                  <StockBadge quantity={product.stock_quantity} />
                </Td>
                {catalogActive && (
                  <Td className="hidden text-center sm:table-cell">
                    <SyncBadge product={product} />
                  </Td>
                )}
                <Td className="text-center">
                  {canEdit ? (
                    <div className="flex justify-center">
                      <Switch
                        checked={product.is_active}
                        disabled={togglingId === product.id}
                        onChange={() => handleToggleActive(product)}
                        aria-label={product.is_active ? 'Hide product' : 'Show product'}
                      />
                    </div>
                  ) : (
                    <Badge tone={product.is_active ? 'success' : 'neutral'}>
                      {product.is_active ? 'Active' : 'Hidden'}
                    </Badge>
                  )}
                </Td>
                {canEdit && (
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(product)} className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(product)}
                        disabled={deletingId === product.id}
                        className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                        title="Delete"
                      >
                        {deletingId === product.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </Td>
                )}
              </Tr>
            ))}
          </TBody>
        </TableShell>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete product"
          description={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
