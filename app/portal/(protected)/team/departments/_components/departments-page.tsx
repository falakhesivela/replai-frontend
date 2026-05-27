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
import { Card, buttonClasses } from '@/components/ui'
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
    if (!window.confirm(`Delete "${dept.name}"? This cannot be undone.`)) return
    try {
      await deleteDepartment(getAccessToken, dept.id)
      void refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Departments</h1>
          <p className="mt-1 text-sm text-gray-500">
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
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {loadError}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="animate-spin" size={18} />
          Loading…
        </div>
      )}

      {!loading && departments.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 px-5 py-12 text-center">
          <Users size={28} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">No departments yet</p>
          <p className="mt-1 text-xs text-gray-500 max-w-xs mx-auto">
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
              onDelete={() => void handleDelete(dept)}
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
            <h3 className="text-sm font-semibold text-gray-900 truncate">{dept.name}</h3>
            {dept.is_active ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                Inactive
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 line-clamp-2">{dept.description}</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="relative w-full max-w-lg rounded-lg border border-gray-200 bg-white shadow-lg max-h-[90vh] flex flex-col">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <form onSubmit={(e) => void submit(e)} className="flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Edit department' : 'New department'}
            </h2>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tech Support"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this department handles — the AI uses this to decide when to route here."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-none"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Be specific — e.g. "Hardware issues, software bugs, login problems, connectivity errors"
              </p>
            </div>

            {isEdit && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${isActive ? 'bg-brand' : 'bg-gray-200'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>
                <span className="text-sm text-gray-700">
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Members
                <span className="ml-1.5 font-normal text-gray-400">({selectedIds.size} selected)</span>
              </label>
              {membersLoading ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 size={14} className="animate-spin" /> Loading members…
                </div>
              ) : teamMembers.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No team members to assign.</p>
              ) : (
                <div className="rounded-md border border-gray-200 divide-y divide-gray-100 max-h-52 overflow-y-auto">
                  {teamMembers.map((member) => {
                    const id = member.member_id!
                    const checked = selectedIds.has(id)
                    const color = member.avatar_color || '#6b7280'
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(id)}
                          className="rounded border-gray-300 text-brand focus:ring-accent"
                        />
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                          style={{ backgroundColor: color }}
                        >
                          {initials(member.name || member.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{member.name || '—'}</p>
                          <p className="text-xs text-gray-400 truncate">{member.email}</p>
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
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            </div>
          )}

          <div className="flex gap-2 p-6 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="flex-1 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
