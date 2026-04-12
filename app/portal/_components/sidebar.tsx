'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  MessageSquare,
  Target,
  Users2,
  Sliders,
  Settings,
  LogOut,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import PortalNotificationsBell from './portal-notifications-bell'

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: null, // no heading for top-level items
    items: [
      { href: '/portal/overview', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Inbox',
    items: [
      { href: '/portal/conversations', label: 'Conversations', icon: MessageSquare },
      { href: '/portal/leads', label: 'Leads', icon: Target },
      { href: '/portal/bookings', label: 'Bookings', icon: Calendar },
      { href: '/portal/broadcasts', label: 'Broadcasts', icon: Megaphone },
    ],
  },
  {
    label: 'Agent',
    items: [
      { href: '/portal/my-agent', label: 'My Agent', icon: Bot },
      { href: '/portal/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/portal/team', label: 'Team', icon: Users2 },
      { href: '/portal/setup', label: 'Setup', icon: Sliders },
      { href: '/portal/settings', label: 'Settings', icon: Settings },
    ],
  },
]

// Flat list for allowedHrefs filtering (preserves existing logic)
const ALL_HREFS = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href))

interface PortalSidebarProps {
  businessName: string
  email: string
  allowedHrefs: string[]
  teamMemberId: string | null
  collapsed: boolean
  onCollapsedChange: (c: boolean) => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function PortalSidebar({
  businessName,
  email,
  allowedHrefs,
  teamMemberId,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileClose,
}: PortalSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    try {
      await fetch('/api/portal/clear-auth-cookies', { method: 'POST' })
    } catch {
      /* non-fatal */
    }
    router.push('/portal/login')
    router.refresh()
  }

  const allowed = new Set(
    allowedHrefs.length > 0 ? allowedHrefs : ALL_HREFS
  )

  function isAllowed(href: string) {
    return allowed.has(href)
  }

  // On mobile: full-width drawer (w-60), slides in from left
  // On desktop: collapsed (w-14) or expanded (w-60), always visible
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 bg-white transition-all duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        ${collapsed ? 'md:w-14' : 'md:w-60'}
        w-60`}
    >
      {/* Header: business name / collapsed logo / mobile close */}
      <div className="flex h-14 items-center border-b border-gray-100 px-3 gap-2 overflow-hidden">
        {!collapsed && (
          <span className="flex-1 truncate text-sm font-semibold text-gray-900">
            {businessName}
          </span>
        )}
        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className="hidden md:flex shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={15} strokeWidth={1.75} /> : <ChevronLeft size={15} strokeWidth={1.75} />}
        </button>
        {/* Mobile close button */}
        <button
          type="button"
          onClick={onMobileClose}
          className="md:hidden shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          aria-label="Close menu"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter((item) => isAllowed(item.href))
          if (visibleItems.length === 0) return null

          return (
            <div key={gi}>
              {/* Group label — hidden when collapsed */}
              {group.label && !collapsed && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {group.label}
                </p>
              )}
              {/* Divider when collapsed (except first group) */}
              {group.label && collapsed && gi > 0 && (
                <div className="mx-auto mb-2 w-6 border-t border-gray-100" />
              )}

              <div className="space-y-0.5">
                {visibleItems.map(({ href, label, icon: Icon }) => {
                  const active = pathname.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={collapsed ? label : undefined}
                      onClick={onMobileClose}
                      className={`flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                        collapsed ? 'md:justify-center' : 'gap-3 px-3'
                      } ${
                        active
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                      <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-2 py-3">
        {!collapsed && (
          <div className="flex items-center justify-between gap-2 px-1 mb-2">
            <p className="truncate text-xs text-gray-400 flex-1">{email}</p>
            {teamMemberId ? <PortalNotificationsBell teamMemberId={teamMemberId} /> : null}
          </div>
        )}
        {collapsed && teamMemberId && (
          <div className="flex justify-center mb-2">
            <PortalNotificationsBell teamMemberId={teamMemberId} />
          </div>
        )}
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign out' : undefined}
          className={`flex w-full items-center rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors ${
            collapsed ? 'md:justify-center' : 'gap-2'
          }`}
        >
          <LogOut size={14} strokeWidth={1.75} />
          <span className={collapsed ? 'md:hidden' : ''}>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
