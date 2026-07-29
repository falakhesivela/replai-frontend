'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  createClientRole,
  deleteClientRole,
  getClientRoles,
  PortalAuthError,
  updateClientRole,
  type TokenGetter,
} from '@/lib/api'
import type { CustomRole } from '@/lib/types'
import { Card, ConfirmDialog } from '@/components/ui'

const getFreshToken: TokenGetter = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

// ── Permission catalogue ──────────────────────────────────────────────────────

const PERMISSION_GROUPS = [
  {
    label: 'Conversations',
    items: [
      { key: 'view_conversations', label: 'View conversations' },
      { key: 'reply_conversations', label: 'Reply to conversations' },
      { key: 'assign_conversations', label: 'Assign conversations' },
    ],
  },
  {
    label: 'Leads',
    items: [
      { key: 'view_leads', label: 'View leads' },
      { key: 'manage_leads', label: 'Manage leads' },
    ],
  },
  {
    label: 'Scheduling',
    items: [
      { key: 'view_bookings', label: 'View bookings' },
      { key: 'manage_bookings', label: 'Manage bookings' },
    ],
  },
  {
    label: 'Analytics & Broadcasts',
    items: [
      { key: 'view_analytics', label: 'View analytics' },
      { key: 'manage_broadcasts', label: 'Manage broadcasts' },
    ],
  },
  {
    label: 'Shop',
    items: [
      { key: 'manage_ecommerce', label: 'Manage shop & orders' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { key: 'manage_agent', label: 'Manage AI agent' },
      { key: 'manage_team', label: 'Manage team' },
      { key: 'view_settings', label: 'View account settings' },
    ],
  },
]

// ── Role form ─────────────────────────────────────────────────────────────────

function RoleForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: { name: string; permissions: string[] }
  onSave: (name: string, permissions: string[]) => void
  onCancel: () => void
  saving: boolean
  error: string | null
}) {
  const [name, setName] = useState(initial.name)
  const [perms, setPerms] = useState<Set<string>>(new Set(initial.permissions))

  function toggle(key: string) {
    setPerms((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Card padding="sm" className="space-y-5">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-2">Role name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Receptionist"
          className="w-full max-w-xs rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Permissions</p>
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-3">{group.label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {group.items.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2 hover:bg-surface-2 transition-colors"
                >
                  <div
                    onClick={() => toggle(key)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      perms.has(key)
                        ? 'border-accent bg-accent'
                        : 'border-line-strong bg-surface'
                    }`}
                  >
                    {perms.has(key) && <Check size={10} strokeWidth={3} className="text-on-solid" />}
                  </div>
                  <span className="text-sm text-ink-2">{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="rounded-md border border-line px-4 py-2 text-xs font-medium text-ink-2 hover:bg-surface-2 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(name.trim(), Array.from(perms))}
          disabled={!name.trim() || saving}
          className="flex items-center gap-1.5 rounded-lg bg-accent shadow-sm shadow-accent/25 px-4 py-2 text-xs font-medium text-on-solid hover:bg-accent-hover transition-colors disabled:opacity-40"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Save role
        </button>
      </div>
    </Card>
  )
}

// ── Role card ─────────────────────────────────────────────────────────────────

const ALL_PERMISSION_LABELS: Record<string, string> = {}
for (const g of PERMISSION_GROUPS) for (const { key, label } of g.items) ALL_PERMISSION_LABELS[key] = label

function RoleCard({
  role,
  onEdit,
  onDelete,
  deleting,
}: {
  role: CustomRole
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2">
            <Shield size={14} strokeWidth={1.75} className="text-ink-2" />
          </div>
          <h3 className="text-sm font-semibold text-ink">{role.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink-2 transition-colors"
          >
            <Pencil size={13} strokeWidth={1.75} />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="rounded-md p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger transition-colors disabled:opacity-40"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {role.permissions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {role.permissions.map((p) => (
            <span key={p} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-ink-2">
              {ALL_PERMISSION_LABELS[p] ?? p}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-3">No permissions assigned.</p>
      )}
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)  // 'new' or role id
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRoles(await getClientRoles(getFreshToken))
    } catch (e) {
      if (e instanceof PortalAuthError) { router.replace('/portal/login'); return }
      setError('Failed to load roles.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void load() }, [load])

  async function handleCreate(name: string, permissions: string[]) {
    setSavingId('new')
    setSaveError(null)
    try {
      const created = await createClientRole(getFreshToken, { name, permissions })
      setRoles((prev) => [...prev, created])
      setShowCreate(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to create role.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleUpdate(roleId: string, name: string, permissions: string[]) {
    setSavingId(roleId)
    setSaveError(null)
    try {
      const updated = await updateClientRole(getFreshToken, roleId, { name, permissions })
      setRoles((prev) => prev.map((r) => (r.id === roleId ? updated : r)))
      setEditingId(null)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to update role.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(roleId: string) {
    setConfirmDeleteId(null)
    setDeletingId(roleId)
    try {
      await deleteClientRole(getFreshToken, roleId)
      setRoles((prev) => prev.filter((r) => r.id !== roleId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete role.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <button
        onClick={() => router.push('/portal/team')}
        className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.75} /> Team
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Roles</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            Create custom roles with specific permissions and assign them to team members.
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => { setShowCreate(true); setEditingId(null); setSaveError(null) }}
            className="flex items-center gap-1.5 rounded-lg bg-accent shadow-sm shadow-accent/25 px-3 py-1.5 text-xs font-medium text-on-solid hover:bg-accent-hover transition-colors"
          >
            <Plus size={13} strokeWidth={2} /> New role
          </button>
        )}
      </div>

      {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-ink-3" />
        </div>
      ) : (
        <div className="space-y-4">
          {showCreate && (
            <RoleForm
              initial={{ name: '', permissions: [] }}
              onSave={handleCreate}
              onCancel={() => { setShowCreate(false); setSaveError(null) }}
              saving={savingId === 'new'}
              error={savingId === 'new' ? saveError : null}
            />
          )}

          {roles.length === 0 && !showCreate ? (
            <div className="rounded-lg border border-dashed border-line py-14 text-center">
              <Shield size={24} className="mx-auto mb-2 text-ink-3/50" />
              <p className="text-sm text-ink-3">No custom roles yet.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-3 text-xs text-info hover:text-info transition-colors"
              >
                Create your first role
              </button>
            </div>
          ) : (
            roles.map((role) =>
              editingId === role.id ? (
                <RoleForm
                  key={role.id}
                  initial={{ name: role.name, permissions: role.permissions }}
                  onSave={(name, permissions) => handleUpdate(role.id, name, permissions)}
                  onCancel={() => { setEditingId(null); setSaveError(null) }}
                  saving={savingId === role.id}
                  error={savingId === role.id ? saveError : null}
                />
              ) : (
                <RoleCard
                  key={role.id}
                  role={role}
                  onEdit={() => { setEditingId(role.id); setShowCreate(false); setSaveError(null) }}
                  onDelete={() => setConfirmDeleteId(role.id)}
                  deleting={deletingId === role.id}
                />
              )
            )
          )}
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete role"
          description="Delete this role? Team members assigned to it will fall back to their base permissions."
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
