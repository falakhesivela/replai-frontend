'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Users, X, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  PortalAuthError,
  createDepartment,
  deleteDepartment,
  getDepartmentMembers,
  getDepartments,
  getPortalTeamDirectory,
  setDepartmentMembers,
  updateDepartment,
} from '@/lib/api'
import type { Department, DepartmentMember, PortalTeamRow } from '@/lib/types'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, buttonClasses, ConfirmDialog } from '@/components/ui'
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function DepartmentsPage() {
  const { can } = usePermissions()
  const canManage = can('manage_team')
  const router = useRouter()

  const getAccessToken = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const [departments, setDepartments] = useState<Department[]>([])
  const [teamMembers, setTeamMembers] = useState<PortalTeamRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal state — null = closed, 'create' = new, department = editing
  const [modal, setModal] = useState<'create' | Department | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const [deps, team] = await Promise.all([
        getDepartments(getAccessToken),
        getPortalTeamDirectory(getAccessToken),
      ])
      setDepartments(deps)
      setTeamMembers(team.rows.filter((r) => r.member_id !== null))
    } catch (e) {
      if (e instanceof PortalAuthError) {
        router.replace(e.status === 403 ? '/portal/overview' : '/portal/login')
        return
      }
      setLoadError(e instanceof Error ? e.message : 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }, [router, getAccessToken])

  useEffect(() => { void refresh() }, [refresh])

  async function handleDelete(dept: Department) {
    setConfirmDelete(null)
    try {
      await deleteDepartment(getAccessToken, dept.id)
      void refresh()
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Departments</h1>
          <p className="mt-1 text-sm text-ink-2">
            Group team members into departments. The AI uses these to route conversations to the right team.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setModal('create')}
            className={buttonClasses()}
          >
            <Plus size={16} strokeWidth={1.75} />
            New department
          </button>
        )}
      </div>

      {loadError && (
        <p className="mb-4 text-sm text-danger bg-danger-soft border border-danger/30 rounded-md px-3 py-2">
          {loadError}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <Loader2 className="animate-spin" size={18} />
          Loading…
        </div>
      )}

      {!loading && departments.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface-2/80 px-5 py-12 text-center">
          <Users size={28} className="mx-auto mb-3 text-ink-3" />
          <p className="text-sm font-medium text-ink-2">No departments yet</p>
          <p className="mt-1 text-xs text-ink-2 max-w-xs mx-auto">
            Create departments like "Sales", "Tech Support", or "Billing" to route conversations to the right team.
          </p>
          {canManage && (
            <button
              type="button"
              onClick={() => setModal('create')}
              className="mt-4 text-sm font-medium text-accent hover:text-accent-hover"
            >
              Create first department
            </button>
          )}
        </div>
      )}

      {departments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              dept={dept}
              canManage={canManage}
              onEdit={() => setModal(dept)}
              onDelete={() => setConfirmDelete(dept)}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <DepartmentModal
          dept={modal === 'create' ? null : modal}
          teamMembers={teamMembers}
          getAccessToken={getAccessToken}
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null)
            void refresh()
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete department"
          description={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          onConfirm={() => void handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

function DepartmentCard({
  dept,
  canManage,
  onEdit,
  onDelete,
}: {
  dept: Department
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card padding="sm" className="shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-ink truncate">{dept.name}</h3>
            {dept.is_active ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3">
                <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                Inactive
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-2 line-clamp-2">{dept.description}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink-2"
              aria-label="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
              aria-label="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}

function DepartmentModal({
  dept,
  teamMembers,
  getAccessToken,
  onClose,
  onSuccess,
}: {
  dept: Department | null
  teamMembers: PortalTeamRow[]
  getAccessToken: () => Promise<string | null>
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = dept !== null

  const [name, setName] = useState(dept?.name ?? '')
  const [description, setDescription] = useState(dept?.description ?? '')
  const [isActive, setIsActive] = useState(dept?.is_active ?? true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [membersLoading, setMembersLoading] = useState(isEdit)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing members when editing
  useEffect(() => {
    if (!dept) return
    void getDepartmentMembers(getAccessToken, dept.id)
      .then((members: DepartmentMember[]) => {
        setSelectedIds(new Set(members.map((m) => m.id)))
      })
      .catch(() => {})
      .finally(() => setMembersLoading(false))
  }, [dept, getAccessToken])

  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setPending(true)
    try {
      let departmentId: string
      if (isEdit) {
        const updated = await updateDepartment(getAccessToken, dept.id, {
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
        })
        departmentId = updated.id
      } else {
        const created = await createDepartment(getAccessToken, {
          name: name.trim(),
          description: description.trim(),
        })
        departmentId = created.id
      }
      await setDepartmentMembers(getAccessToken, departmentId, Array.from(selectedIds))
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save department')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-xl border border-line bg-surface shadow-card max-h-[90vh] flex flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink-2"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <form onSubmit={(e) => void submit(e)} className="flex flex-col overflow-hidden">
          <div className="p-6 border-b border-line">
            <h2 className="text-lg font-semibold text-ink">
              {isEdit ? 'Edit department' : 'New department'}
            </h2>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tech Support"
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-1">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this department handles — the AI uses this to decide when to route here."
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink shadow-xs transition-shadow focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 resize-none"
              />
              <p className="mt-1 text-[11px] text-ink-3">
                Be specific — e.g. "Hardware issues, software bugs, login problems, connectivity errors"
              </p>
            </div>

            {isEdit && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${isActive ? 'bg-accent' : 'bg-line'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-surface shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
                <span className="text-sm text-ink-2">
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-ink-2 mb-2">
                Members
                <span className="ml-1.5 font-normal text-ink-3">({selectedIds.size} selected)</span>
              </label>
              {membersLoading ? (
                <div className="flex items-center gap-2 text-xs text-ink-3 py-2">
                  <Loader2 size={14} className="animate-spin" /> Loading members…
                </div>
              ) : teamMembers.length === 0 ? (
                <p className="text-xs text-ink-3 py-2">No team members to assign.</p>
              ) : (
                <div className="rounded-md border border-line divide-y divide-line max-h-52 overflow-y-auto">
                  {teamMembers.map((member) => {
                    const id = member.member_id!
                    const checked = selectedIds.has(id)
                    const color = member.avatar_color || '#6b7280'
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-2"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(id)}
                          className="rounded border-line-strong text-accent-text focus:ring-accent"
                        />
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-on-solid"
                          style={{ backgroundColor: color }}
                        >
                          {initials(member.name || member.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{member.name || '—'}</p>
                          <p className="text-xs text-ink-3 truncate">{member.email}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="px-6 pb-0">
              <p className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-md px-3 py-2">
                {error}
              </p>
            </div>
          )}

          <div className="flex gap-2 p-6 pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-2 shadow-xs hover:border-line-strong hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="flex-1 rounded-lg bg-accent shadow-sm shadow-accent/25 px-4 py-2 text-sm font-medium text-on-solid hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
