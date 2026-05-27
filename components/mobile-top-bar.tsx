'use client'

import Image from 'next/image'
import { Menu } from 'lucide-react'

interface MobileTopBarProps {
  onMenuClick: () => void
}

/** Mobile-only chrome shared by every shell (admin + portal). Desktop renders
 *  nothing here — pages own their headers via <PageHeader>. Keeping this in
 *  one place is what prevents the two shells from drifting again. */
export default function MobileTopBar({ onMenuClick }: MobileTopBarProps) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 md:hidden">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>
      <Image
        src="/images/replai_logo.png"
        alt="Replai"
        width={80}
        height={24}
        className="object-contain object-left"
        priority
      />
    </header>
  )
}
