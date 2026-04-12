'use client'

import { Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'

const TITLES: Record<string, string> = {
  '/dashboard/clients': 'Clients',
  '/dashboard/settings': 'Settings',
}

function getTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(TITLES)) {
    if (pathname.startsWith(prefix)) return title
  }
  return 'Dashboard'
}

interface TopBarProps {
  onMenuClick?: () => void
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const pathname = usePathname()
  const title = getTitle(pathname)

  return (
    <header className="flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden rounded-md p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>
      <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
    </header>
  )
}
