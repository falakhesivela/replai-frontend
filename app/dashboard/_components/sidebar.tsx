'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Users, Settings, LogOut, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  email: string
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ email, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-gray-200 bg-white transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0`}
    >
      {/* Logo + mobile close button */}
      <div className="flex h-14 items-center justify-between px-5 border-b border-gray-100">
        <span className="text-lg font-semibold tracking-tight text-gray-900">Replai</span>
        <button
          type="button"
          onClick={onMobileClose}
          className="md:hidden rounded-md p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close menu"
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-4 py-4">
        <p className="truncate text-xs text-gray-400 mb-2">{email}</p>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut size={14} strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
