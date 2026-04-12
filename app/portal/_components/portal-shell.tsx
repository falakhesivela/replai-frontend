'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import PortalSidebar from './sidebar'

interface PortalShellProps {
  businessName: string
  email: string
  allowedHrefs: string[]
  teamMemberId: string | null
  children: React.ReactNode
}

export default function PortalShell({
  businessName,
  email,
  allowedHrefs,
  teamMemberId,
  children,
}: PortalShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <PortalSidebar
        businessName={businessName}
        email={email}
        allowedHrefs={allowedHrefs}
        teamMemberId={teamMemberId}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={`flex min-h-screen flex-col transition-all duration-200 ${
          collapsed ? 'md:ml-14' : 'md:ml-60'
        }`}
      >
        {/* Mobile top bar */}
        <header className="flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <span className="text-sm font-semibold text-gray-900 truncate">{businessName}</span>
        </header>

        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
