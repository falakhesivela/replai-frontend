'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  LayoutDashboard,
  Bot,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronLeft,
  Code2,
  CreditCard,
  FlaskConical,
  Megaphone,
  MessageSquare,
  Package,
  ShoppingBag,
  Target,
  Users2,
  Sliders,
  Settings,
  Plug,
  LogOut,
  Lock,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { featureForHref } from '@/lib/entitlements'
import PortalNotificationsBell from './portal-notifications-bell'
import { ThemeToggle } from '@/components/ui/theme-toggle'

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: '/portal/overview', label: 'Overview', icon: LayoutDashboard },
      { href: '/portal/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Messaging',
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
      { href: '/portal/playground', label: 'Playground', icon: FlaskConical },
      { href: '/portal/chatbot-widget', label: 'Chatbot Widget', icon: Code2 },
    ],
  },
  {
    // Booking flow first, commerce second — co-located because both are
    // operational business-data CRUD (replaces two 2-item groups: Shop + Scheduling).
    label: 'Operations',
    items: [
      { href: '/portal/bookings', label: 'Bookings', icon: Calendar },
      { href: '/portal/setup', label: 'Booking Setup', icon: Sliders },
      { href: '/portal/ecommerce/products', label: 'Products', icon: Package },
      { href: '/portal/ecommerce/orders', label: 'Orders', icon: ShoppingBag },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { href: '/portal/team', label: 'Team', icon: Users2 },
      { href: '/portal/integrations', label: 'Integrations', icon: Plug },
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
  lockedHrefs?: string[]
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
  lockedHrefs = [],
  teamMemberId,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileClose,
}: PortalSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const allowed = new Set(allowedHrefs.length > 0 ? allowedHrefs : ALL_HREFS)
  const locked = new Set(lockedHrefs)

  const defaultCollapsed: Record<string, boolean> = { Operations: true }

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const initial = { ...defaultCollapsed }
    for (const group of NAV_GROUPS) {
      if (group.label && initial[group.label]) {
        if (group.items.some((item) => pathname.startsWith(item.href))) {
          initial[group.label] = false
        }
      }
    }
    return initial
  })

  // Auto-expand a group when the user navigates into one of its routes.
  useEffect(() => {
    setCollapsedGroups((prev) => {
      const next = { ...prev }
      let changed = false
      for (const group of NAV_GROUPS) {
        if (group.label && next[group.label]) {
          if (group.items.some((item) => pathname.startsWith(item.href))) {
            next[group.label] = false
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [pathname])

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
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface shadow-overlay transition-all duration-200 md:shadow-none
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        ${collapsed ? 'md:w-14' : 'md:w-60'}
        w-60`}
    >
      {/* Header */}
      <div className={`flex h-14 items-center border-b border-line ${collapsed ? '' : 'px-3 gap-2'}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            className="hidden md:flex w-full h-full items-center justify-center hover:bg-surface-2 transition-colors"
            aria-label="Expand sidebar"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/replai_R.png"
              alt="Replai"
              className="w-7 h-7 object-contain dark:brightness-0 dark:invert"
            />
          </button>
        ) : (
          <>
            <div className="flex flex-1 min-w-0 flex-col justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/replai_logo.png"
                alt="Replai"
                className="h-8 w-auto object-contain object-left dark:brightness-0 dark:invert"
              />
            </div>
            <button
              type="button"
              onClick={() => onCollapsedChange(true)}
              className="hidden md:flex shrink-0 rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={15} strokeWidth={1.75} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onMobileClose}
          className="md:hidden shrink-0 rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
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
                  className="flex w-full items-center justify-between px-3 py-1 rounded-md hover:bg-surface-2 transition-colors group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-3 group-hover:text-ink-2 transition-colors">
                    {group.label}
                  </span>
                  <ChevronDown
                    size={11}
                    strokeWidth={2}
                    className={`text-ink-3 transition-transform duration-150 ${groupCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
              )}

              {/* Divider when sidebar is icon-only */}
              {group.label && collapsed && gi > 0 && (
                <div className="mx-auto mb-1 w-6 border-t border-line" />
              )}

              {/* Items — hidden when group is collapsed (unless sidebar is icon-only) */}
              {(!groupCollapsed || collapsed) && (
                <div className="mt-0.5 space-y-0.5">
                  {visibleItems.map(({ href, label, icon: Icon }) => {
                    const active = pathname.startsWith(href)
                    const isLocked = locked.has(href)

                    // Locked feature: keep it visible but route to the
                    // subscription page (upsell) instead of the gated page.
                    if (isLocked) {
                      return (
                        <Link
                          key={href}
                          href={`/portal/subscription?feature=${featureForHref(href) ?? ''}`}
                          title={collapsed ? `${label} — upgrade to unlock` : undefined}
                          onClick={onMobileClose}
                          className={`group flex items-center rounded-lg px-2 py-1.5 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2 ${
                            collapsed ? 'md:justify-center' : 'gap-3 px-3'
                          }`}
                        >
                          <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                          <span className={`flex-1 ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
                          <Lock
                            size={12}
                            strokeWidth={2}
                            className={`shrink-0 text-ink-3/70 group-hover:text-ink-3 ${collapsed ? 'md:hidden' : ''}`}
                          />
                        </Link>
                      )
                    }

                    return (
                      <Link
                        key={href}
                        href={href}
                        title={collapsed ? label : undefined}
                        onClick={onMobileClose}
                        className={`relative flex items-center rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                          collapsed ? 'md:justify-center' : 'gap-3 px-3'
                        } ${
                          active
                            ? 'bg-accent-soft text-accent-text before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-accent'
                            : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                        }`}
                      >
                        <Icon
                          size={16}
                          strokeWidth={active ? 2 : 1.75}
                          className="shrink-0"
                        />
                        <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* When a group is collapsed but contains the active route, show a subtle indicator */}
              {groupCollapsed && !collapsed && hasActiveItem && (
                <div className="mx-3 my-0.5 h-0.5 rounded-full bg-accent" />
              )}
            </div>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-line px-2 py-3">
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-1 mb-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-hover text-[11px] font-semibold text-on-solid">
              {(businessName || email).charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              {businessName && (
                <p className="truncate text-xs font-medium text-ink leading-tight">{businessName}</p>
              )}
              <p className="truncate text-[11px] text-ink-3 leading-tight">{email}</p>
            </div>
            {teamMemberId ? <PortalNotificationsBell teamMemberId={teamMemberId} /> : null}
            <ThemeToggle />
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-1 mb-2">
            {teamMemberId && <PortalNotificationsBell teamMemberId={teamMemberId} />}
            <ThemeToggle />
          </div>
        )}
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign out' : undefined}
          className={`flex w-full items-center rounded-lg px-2 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors ${
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
