'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShoppingBag,
  TriangleAlert,
} from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  autoCreateWhatsAppCatalog,
  connectWhatsAppCatalog,
  disconnectWhatsAppCatalog,
  getMyWhatsAppCatalogStatus,
  syncWhatsAppCatalogNow,
  toggleWhatsAppCatalog,
  type TokenGetter,
} from '@/lib/api'
import type { WhatsAppCatalogStatus } from '@/lib/types'
import { useToast } from '@/components/toast'
import { useMetaOAuthCode } from '@/hooks/useMetaOAuthCode'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, ConfirmDialog, Field, Input, Switch, buttonClasses } from '@/components/ui'

const CATALOG_CONFIG_ID = process.env.NEXT_PUBLIC_META_CATALOG_CONFIG_ID || ''

const getFreshToken: TokenGetter = async () => {
  const supabase = createSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

const SYNC_TILES: { key: keyof WhatsAppCatalogStatus['products']; label: string; tone: string }[] = [
  { key: 'synced', label: 'Synced', tone: 'text-success' },
  { key: 'pending', label: 'Pending', tone: 'text-warning' },
  { key: 'error', label: 'Errors', tone: 'text-danger' },
  { key: 'skipped', label: 'No image', tone: 'text-ink-3' },
]

export default function WhatsAppCatalogView() {
  const { toast } = useToast()
  const { can } = usePermissions()
  const canManage = can('manage_settings')
  const { requestCode } = useMetaOAuthCode()

  const [status, setStatus] = useState<WhatsAppCatalogStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [catalogId, setCatalogId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await getMyWhatsAppCatalogStatus(getFreshToken))
    } catch {
      toast.error('Could not load your WhatsApp Catalog connection.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleConnect() {
    if (!catalogId.trim()) return
    setConnecting(true)
    try {
      // When the server has a catalog configuration, ask Meta for catalog
      // permission first — the WhatsApp connection alone doesn't carry it.
      let code: string | undefined
      if (status?.oauth_available && !status.has_catalog_grant) {
        const granted = await requestCode(CATALOG_CONFIG_ID)
        if (!granted) {
          toast.error('Catalog access was not granted.')
          return
        }
        code = granted
      }
      setStatus(await connectWhatsAppCatalog(getFreshToken, catalogId.trim(), code))
      setCatalogId('')
      toast.success('Catalog connected — syncing your products now.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect that catalog.')
    } finally {
      setConnecting(false)
    }
  }

  async function handleAutoCreate() {
    setCreating(true)
    try {
      setStatus(await autoCreateWhatsAppCatalog(getFreshToken))
      toast.success('Catalog created — syncing your products now.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create a catalog.')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggle(enabled: boolean) {
    setToggling(true)
    try {
      setStatus(await toggleWhatsAppCatalog(getFreshToken, enabled))
      toast.success(enabled ? 'Native product messages enabled.' : 'Native product messages paused.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the setting.')
    } finally {
      setToggling(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await syncWhatsAppCatalogNow(getFreshToken)
      setStatus(result)
      toast.success('Sync complete.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      setStatus(await disconnectWhatsAppCatalog(getFreshToken))
      toast.success('Catalog disconnected. Items already on Meta are kept.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not disconnect.')
    } finally {
      setDisconnecting(false)
      setConfirmDisconnect(false)
    }
  }

  const connected = status?.status === 'active'

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
        <h1 className="text-2xl font-semibold tracking-tight text-ink">WhatsApp Catalog</h1>
        <p className="mt-1 text-sm text-ink-2">
          Show your products as native WhatsApp cards with Meta’s built-in cart.
          Your Replai product list stays the source of truth — changes here are
          pushed to the Meta catalog automatically, and customers can still order
          the classic way if anything is unavailable.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
        </div>
      ) : !status?.configured ? (
        <Card>
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-sm text-ink-2">
              WhatsApp Catalog isn’t enabled on this Replai environment yet. Once
              it’s switched on for your workspace, you’ll be able to connect a Meta
              catalog here.
            </p>
          </div>
        </Card>
      ) : !status.whatsapp_connected ? (
        <Card>
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-sm text-ink-2">
              Connect your WhatsApp number first — the catalog uses the same Meta
              connection. Head to{' '}
              <Link href="/portal/settings" className="underline text-ink-2 hover:text-ink">
                Settings
              </Link>{' '}
              to connect WhatsApp, then come back here.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2">
                <ShoppingBag size={18} className="text-ink-2" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Connection status</p>

                {connected ? (
                  <div className="mt-2 space-y-3 text-sm text-ink-2">
                    <p className="inline-flex items-center gap-1.5 text-success">
                      <CheckCircle2 size={14} />
                      Connected{status.catalog_name ? ` — ${status.catalog_name}` : ''}
                      {status.catalog_id ? ` (${status.catalog_id})` : ''}
                    </p>
                    {status.last_error && (
                      <p className="inline-flex items-center gap-1.5 text-warning">
                        <TriangleAlert size={14} />
                        {status.last_error}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-4 rounded-md bg-surface-2 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-ink">Send native product cards</p>
                        <p className="text-xs text-ink-3">
                          When off, customers see the classic text list instead. Syncing continues either way.
                        </p>
                      </div>
                      <Switch
                        checked={status.enabled}
                        onChange={(v: boolean) => handleToggle(v)}
                        disabled={!canManage || toggling}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {canManage && (
                        <>
                          <button
                            onClick={handleSync}
                            disabled={syncing}
                            className={buttonClasses({ variant: 'secondary' })}
                          >
                            {syncing ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Syncing…
                              </>
                            ) : (
                              <>
                                <RefreshCw size={14} />
                                Sync now
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDisconnect(true)}
                            disabled={disconnecting}
                            className={buttonClasses({ variant: 'secondary' })}
                          >
                            Disconnect
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-3">
                    <p className="text-sm text-ink-2">
                      Paste the Catalog ID from Meta Commerce Manager
                      (Commerce Manager → your catalog → Settings), or create a new
                      catalog automatically.
                      {status.oauth_available && !status.has_catalog_grant && (
                        <> Meta will ask you to grant access to your catalog.</>
                      )}
                    </p>
                    {canManage ? (
                      <>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Field label="Catalog ID" htmlFor="catalog-id">
                              <Input
                                id="catalog-id"
                                value={catalogId}
                                onChange={(e) => setCatalogId(e.target.value)}
                                placeholder="e.g. 1234567890123456"
                              />
                            </Field>
                          </div>
                          <button
                            onClick={handleConnect}
                            disabled={connecting || !catalogId.trim()}
                            className={buttonClasses({ variant: 'primary' })}
                          >
                            {connecting ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Connecting…
                              </>
                            ) : (
                              'Connect'
                            )}
                          </button>
                        </div>
                        {status.auto_create_available && (
                          <button
                            onClick={handleAutoCreate}
                            disabled={creating}
                            className={buttonClasses({ variant: 'secondary' })}
                          >
                            {creating ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Creating…
                              </>
                            ) : (
                              'Create a catalog for me'
                            )}
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-ink-3">
                        Ask a workspace owner to connect the catalog.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {connected && (
            <Card>
              <p className="text-sm font-semibold text-ink">Product sync</p>
              <p className="mt-1 text-xs text-ink-3">
                {status.products.total} product{status.products.total === 1 ? '' : 's'} in your
                Replai list. Products without an image are skipped — Meta requires one.
                {status.last_synced_at
                  ? ` Last synced ${new Date(status.last_synced_at).toLocaleString()}.`
                  : ''}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SYNC_TILES.map((tile) => (
                  <div key={tile.key} className="rounded-md bg-surface-2 px-3 py-2.5">
                    <p className={`text-lg font-semibold ${tile.tone}`}>
                      {status.products[tile.key]}
                    </p>
                    <p className="text-xs text-ink-3">{tile.label}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {confirmDisconnect && (
        <ConfirmDialog
          title="Disconnect WhatsApp Catalog?"
          description="Native product cards stop sending and syncing pauses. Items already in your Meta catalog are not deleted."
          confirmLabel={disconnecting ? 'Disconnecting…' : 'Disconnect'}
          onConfirm={handleDisconnect}
          onCancel={() => setConfirmDisconnect(false)}
        />
      )}
    </div>
  )
}
