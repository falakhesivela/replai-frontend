'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { readPortalUiRoleFromDocument } from '@/lib/portal-login'
import { hasPortalPermission, type PortalRole } from '@/lib/portal-permissions'

/**
 * Client-side portal authz from `portal_ui_role` cookie (set by proxy/middleware).
 * Re-reads on route changes so role stays in sync after navigation.
 */
export function usePermissions() {
  const pathname = usePathname()
  const [cookieRole, setCookieRole] = useState<PortalRole | null>(() =>
    typeof window !== 'undefined' ? readPortalUiRoleFromDocument() : null
  )

  useEffect(() => {
    setCookieRole(readPortalUiRoleFromDocument())
  }, [pathname])

  const role: PortalRole = cookieRole ?? 'agent'

  return useMemo(
    () => ({
      can: (permission: string) => hasPortalPermission(role, permission),
      role,
      isOwner: role === 'owner',
      isManager: role === 'manager',
      isAgent: role === 'agent',
    }),
    [role]
  )
}
