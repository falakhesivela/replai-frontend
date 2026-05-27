'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Loader2, UserPlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  PortalAuthError,
  getClientRoles,
  getPortalTeamDirectory,
  invitePortalTeamMember,
  patchPortalTeamMember,
  removePortalTeamMember,
} from '@/lib/api'
import type { CustomRole, PortalTeamDirectory, PortalTeamRow } from '@/lib/types'
import { usePermissions } from '@/hooks/usePermissions'
import { buttonClasses } from '@/components/ui'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function roleBadgeClasses(role: PortalTeamRow['role']): string {
  if (role === 'owner') return 'bg-violet-100 text-violet-800 ring-violet-600/15'
  if (role === 'manager') return 'bg-blue-100 text-blue-800 ring-blue-600/15'
  return 'bg-gray-100 text-gray-700 ring-gray-500/15'
}

function roleLabel(role: PortalTeamRow['role']): string {
  if (role === 'owner') return 'Owner'
  if (role === 'manager') return 'Manager'
  return 'Agent'
}

function portalLoginUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  if (env) return `${env}/portal/login`
  if (typeof window !== 'undefined') return `${window.location.origin}/portal/login`
  return '/portal/login'
}

export function TeamMembersPage() {
  const { can } = usePermissions()
  const canManageTeam = can('manage_team')
  const router = useRouter()
  const getAccessToken = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])
  const [data, setData] = useState<PortalTeamDirectory | null>(null)
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [rowBusy, setRowBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const [d, roles] = await Promise.all([
        getPortalTeamDirectory(getAccessToken),
        getClientRoles(getAccessToken).catch(() => [] as CustomRole[]),
      ])
      setData(d)
      setCustomRoles(roles)
    } catch (e) {
      if (e instanceof PortalAuthError) {
        if (e.status === 403) {
          router.replace('/portal/overview')
          return
        }
        router.replace('/portal/login')
        return
      }
      setLoadError(e instanceof Error ? e.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }, [router, getAccessToken])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const memberOnlyRows = data?.rows.filter((r) => r.member_id) ?? []
  const onlyOwner = memberOnlyRows.length === 0

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1 className="text-xl font-semibold text-gray-900">Team Members</h1>
        <div className="flex items-center gap-2">
          {canManageTeam && (
            <button
              type="button"
              onClick={() => router.push('/portal/team/roles')}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Manage roles
            </button>
          )}
          {data?.can_invite && canManageTeam && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className={buttonClasses()}
            >
              <UserPlus size={16} strokeWidth={1.75} />
              Invite member
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {loadError}
        </p>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="animate-spin" size={18} />
          Loading team…
        </div>
      )}

      {data && (
        <>
          {onlyOwner && (
            <div className="mb-6 rounded-lg border border-dashed border-gray-300 bg-gray-50/80 px-5 py-8 text-center">
              <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                Just you so far. Invite team members to collaborate on conversations.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3 w-14" />
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Assigned</th>
                    {canManageTeam && <th className="px-4 py-3 w-48">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.rows.map((row) => (
                    <TeamRowView
                      key={row.member_id ?? `owner-${row.user_id}`}
                      row={row}
                      readOnly={!canManageTeam}
                      getAccessToken={getAccessToken}
                      busyId={rowBusy}
                      setBusy={setRowBusy}
                      onUpdated={refresh}
                      customRoles={customRoles}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {inviteOpen && data && (
        <InviteModal
          getAccessToken={getAccessToken}
          customRoles={customRoles}
          onClose={() => setInviteOpen(false)}
          onSuccess={() => {
            setInviteOpen(false)
            void refresh()
          }}
        />
      )}
    </div>
  )
}

function TeamRowView({
  row,
  readOnly,
  getAccessToken,
  busyId,
  setBusy,
  onUpdated,
  customRoles,
}: {
  row: PortalTeamRow
  readOnly: boolean
  getAccessToken: () => Promise<string | null>
  busyId: string | null
  setBusy: (id: string | null) => void
  onUpdated: () => Promise<void>
  customRoles: CustomRole[]
}) {
  const router = useRouter()
  const mid = row.member_id
  const busy = mid != null && busyId === mid

  async function onRoleChange(value: string) {
    if (!mid || !row.actions.change_role) return
    setBusy(mid)
    try {
      if (value === 'manager' || value === 'agent') {
        await patchPortalTeamMember(getAccessToken, mid, { role: value, custom_role_id: '' })
      } else {
        // value is a custom_role_id — base tier stays agent
        await patchPortalTeamMember(getAccessToken, mid, { role: 'agent', custom_role_id: value })
      }
      await onUpdated()
    } finally {
      setBusy(null)
    }
  }

  async function setActive(active: boolean) {
    if (!mid || !row.actions.deactivate) return
    setBusy(mid)
    try {
      await patchPortalTeamMember(getAccessToken, mid, { is_active: active })
      await onUpdated()
    } finally {
      setBusy(null)
    }
  }

  async function onRemove() {
    if (!mid || !row.actions.remove) return
    if (
      !window.confirm(
        `Remove ${row.name} from the team? They will lose portal access and assigned conversations will be unassigned.`
      )
    ) {
      return
    }
    setBusy(mid)
    try {
      await removePortalTeamMember(getAccessToken, mid)
      await onUpdated()
    } finally {
      setBusy(null)
    }
  }

  const color = row.avatar_color || '#6b7280'

  return (
    <tr
      className={`hover:bg-gray-50/60 ${mid ? 'cursor-pointer' : ''}`}
      onClick={mid ? () => router.push(`/portal/team/${mid}`) : undefined}
    >
      <td className="px-4 py-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          {initials(row.name || row.email)}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900">{row.name || '—'}</span>
          {row.is_self && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              You
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">{row.email || '—'}</td>
      <td className="px-4 py-3">
        {row.custom_role ? (
          <span className="inline-flex rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium ring-1 ring-brand/15 text-brand">
            {row.custom_role.name}
          </span>
        ) : (
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${roleBadgeClasses(row.role)}`}
          >
            {roleLabel(row.role)}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        {row.role === 'owner' ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Active
          </span>
        ) : row.is_active ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
            Inactive
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
        {row.conversation_count}
      </td>
      {!readOnly && (
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {mid && (row.actions.change_role || row.actions.deactivate || row.actions.remove) ? (
            <div className="flex flex-col gap-2 items-stretch">
              {row.actions.change_role && !row.is_self && (
                <select
                  disabled={busy}
                  value={row.custom_role?.id ?? (row.role === 'agent' ? 'agent' : 'manager')}
                  onChange={(e) => void onRoleChange(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                >
                  {customRoles.length > 0 && (
                    <optgroup label="Custom roles">
                      {customRoles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Default">
                    <option value="manager">Manager</option>
                    <option value="agent">Agent</option>
                  </optgroup>
                </select>
              )}
              <div className="flex flex-wrap gap-1.5">
                {row.actions.deactivate && row.is_active && !row.is_self && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setActive(false)}
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                )}
                {row.actions.deactivate && !row.is_active && !row.is_self && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setActive(true)}
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Reactivate
                  </button>
                )}
                {row.actions.remove && !row.is_self && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onRemove()}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              {busy && <Loader2 className="animate-spin text-gray-400" size={14} />}
            </div>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </td>
      )}
    </tr>
  )
}

function InviteModal({
  getAccessToken,
  customRoles,
  onClose,
  onSuccess,
}: {
  getAccessToken: () => Promise<string | null>
  customRoles: CustomRole[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  // roleValue is either a custom role id, 'manager', or 'agent'
  const [roleValue, setRoleValue] = useState<string>('agent')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{
    name: string
    temp_password: string
    email_sent: boolean
  } | null>(null)
  const [copied, setCopied] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const isCustom = roleValue !== 'manager' && roleValue !== 'agent'
      const res = await invitePortalTeamMember(getAccessToken, {
        name: name.trim(),
        email: email.trim(),
        role: isCustom ? 'agent' : (roleValue as 'manager' | 'agent'),
        custom_role_id: isCustom ? roleValue : null,
      })
      setDone({
        name: res.name,
        temp_password: res.temp_password,
        email_sent: res.email_sent !== false,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setPending(false)
    }
  }

  async function copyPassword() {
    if (!done) return
    await navigator.clipboard.writeText(done.temp_password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const login = portalLoginUrl()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="relative w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-lg">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {done ? (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {done.email_sent ? 'Invite sent' : 'Member added'}
            </h2>
            {!done.email_sent && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                We could not send the invitation email (check Resend API key and verified sender
                domain). Share the temporary password below with {done.name} manually.
              </p>
            )}
            <p className="text-sm text-gray-600">
              Share this with {done.name} to log in
            </p>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-sm break-all text-gray-900">
              {done.temp_password}
            </div>
            <button
              type="button"
              onClick={() => void copyPassword()}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Copy size={14} />
              {copied ? 'Copied' : 'Copy password'}
            </button>
            <p className="text-xs text-gray-500">
              Portal login:{' '}
              <span className="font-mono text-gray-700 break-all">{login}</span>
            </p>
            <button
              type="button"
              onClick={onSuccess}
              className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Invite member</h2>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="colleague@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
              <select
                value={roleValue}
                onChange={(e) => setRoleValue(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {customRoles.length > 0 && (
                  <optgroup label="Custom roles">
                    {customRoles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Default">
                  <option value="manager">Manager</option>
                  <option value="agent">Agent</option>
                </optgroup>
              </select>
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {pending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
