'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Bookmark,
  Calendar,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  Megaphone,
  MessageSquare,
  Package,
  ShieldCheck,
  ShoppingBag,
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
    label: null,
    items: [
      { href: '/portal/overview', label: 'Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Inbox',
    items: [
      { href: '/portal/conversations', label: 'Conversations', icon: MessageSquare },
      { href: '/portal/leads', label: 'Leads', icon: Target },
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
    label: 'Shop',
    items: [
      { href: '/portal/ecommerce/products', label: 'Products', icon: Package },
      { href: '/portal/ecommerce/orders', label: 'Orders', icon: ShoppingBag },
    ],
  },
  {
    label: 'Scheduling',
    items: [
      { href: '/portal/bookings', label: 'Bookings', icon: Calendar },
      { href: '/portal/my-bookings', label: 'My Bookings', icon: Bookmark },
      { href: '/portal/setup', label: 'Services', icon: Sliders },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/portal/team', label: 'Team', icon: Users2 },
      { href: '/portal/team/roles', label: 'Roles', icon: ShieldCheck },
      { href: '/portal/settings', label: 'Settings', icon: Settings },
      { href: '/portal/subscription', label: 'Subscription', icon: CreditCard },
    ],
  },
]

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

  const allowed = new Set(allowedHrefs.length > 0 ? allowedHrefs : ALL_HREFS)

  // Track which labeled groups are collapsed. Default: all expanded.
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    Shop: true,
    Scheduling: true,
  })

  function toggleGroup(label: string) {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    try {
      await fetch('/api/portal/clear-auth-cookies', { method: 'POST' })
    } catch { /* non-fatal */ }
    router.push('/portal/login')
    router.refresh()
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 bg-white transition-all duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        ${collapsed ? 'md:w-14' : 'md:w-60'}
        w-60`}
    >
      {/* Header */}
      <div className={`flex h-14 items-center border-b border-gray-100 ${collapsed ? '' : 'px-3 gap-2'}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            className="hidden md:flex w-full h-full items-center justify-center hover:bg-gray-50 transition-colors"
            aria-label="Expand sidebar"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/replai_R.png"
              alt="Replai"
              className="w-7 h-7 object-contain"
            />
          </button>
        ) : (
          <>
            <div className="flex flex-1 min-w-0 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/replai_logo.png"
                alt="Replai"
                className="h-6 w-auto object-contain"
              />
            </div>
            <button
              type="button"
              onClick={() => onCollapsedChange(true)}
              className="hidden md:flex shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={15} strokeWidth={1.75} />
            </button>
          </>
        )}
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
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter((item) => allowed.has(item.href))
          if (visibleItems.length === 0) return null

          const groupCollapsed = group.label ? (collapsedGroups[group.label] ?? false) : false
          const hasActiveItem = visibleItems.some((item) => pathname.startsWith(item.href))

          return (
            <div key={gi} className={gi > 0 && group.label ? 'pt-1' : ''}>
              {/* Group label row — clickable to collapse/expand */}
              {group.label && !collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label!)}
                  className="flex w-full items-center justify-between px-3 py-1 rounded-md hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-500 transition-colors">
                    {group.label}
                  </span>
                  <ChevronDown
                    size={11}
                    strokeWidth={2}
                    className={`text-gray-300 transition-transform duration-150 ${groupCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
              )}

              {/* Divider when sidebar is icon-only */}
              {group.label && collapsed && gi > 0 && (
                <div className="mx-auto mb-1 w-6 border-t border-gray-100" />
              )}

              {/* Items — hidden when group is collapsed (unless sidebar is icon-only) */}
              {(!groupCollapsed || collapsed) && (
                <div className="mt-0.5 space-y-0.5">
                  {visibleItems.map(({ href, label, icon: Icon }) => {
                    const active = pathname.startsWith(href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        title={collapsed ? label : undefined}
                        onClick={onMobileClose}
                        className={`flex items-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                          collapsed ? 'md:justify-center' : 'gap-3 px-3'
                        } ${
                          active
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                        <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* When collapsed: show dot indicator if group has active item and is collapsed */}
              {groupCollapsed && !collapsed && hasActiveItem && (
                <div className="flex items-center gap-3 px-3 py-1.5">
                  <div className="h-1 w-1 rounded-full bg-gray-400" />
                  <span className="text-xs text-gray-400 italic">hidden</span>
                </div>
              )}
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
