'use client'

import { useState } from 'react'
import PortalSidebar from './sidebar'
import MobileTopBar from '@/components/mobile-top-bar'
import { PortalLegalFooter } from './portal-legal-footer'

interface PortalShellProps {
  businessName: string
  email: string
  allowedHrefs: string[]
  lockedHrefs?: string[]
  teamMemberId: string | null
  initialCollapsed?: boolean
  children: React.ReactNode
}

const COLLAPSED_COOKIE = 'portal_sidebar_collapsed'

export default function PortalShell({
  businessName,
  email,
  allowedHrefs,
  lockedHrefs = [],
  teamMemberId,
  initialCollapsed = false,
  children,
}: PortalShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleCollapsedChange = (next: boolean) => {
    setCollapsed(next)
    document.cookie = `${COLLAPSED_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <PortalSidebar
        businessName={businessName}
        email={email}
        allowedHrefs={allowedHrefs}
        lockedHrefs={lockedHrefs}
        teamMemberId={teamMemberId}
        collapsed={collapsed}
        onCollapsedChange={handleCollapsedChange}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={`flex min-h-screen flex-col transition-all duration-200 ${
          collapsed ? 'md:ml-14' : 'md:ml-60'
        }`}
      >
        <MobileTopBar onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>

        <PortalLegalFooter className="px-4 pb-4 md:px-8 md:pb-6" />
      </div>
    </div>
  )
}
