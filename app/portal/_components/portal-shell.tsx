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
  children: React.ReactNode
}

export default function PortalShell({
  businessName,
  email,
  allowedHrefs,
  lockedHrefs = [],
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
        lockedHrefs={lockedHrefs}
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
        <MobileTopBar onMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>

        <PortalLegalFooter className="px-4 pb-4 md:px-6 md:pb-6" />
      </div>
    </div>
  )
}
