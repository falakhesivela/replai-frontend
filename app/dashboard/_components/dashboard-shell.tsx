'use client'

import { useState } from 'react'
import Sidebar from './sidebar'
import MobileTopBar from '@/components/mobile-top-bar'

interface DashboardShellProps {
  email: string
  children: React.ReactNode
}

export default function DashboardShell({ email, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-950/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        email={email}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-h-screen flex-col md:ml-60">
        <MobileTopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
