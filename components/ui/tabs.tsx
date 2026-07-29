'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from './cn'

const TAB_BASE =
  'relative flex items-center gap-1.5 rounded-t-md border-b-2 -mb-px px-4 py-2 text-sm font-medium transition-colors'
const TAB_ACTIVE = 'border-accent text-accent-text'
const TAB_INACTIVE =
  'border-transparent text-ink-3 hover:bg-surface-2 hover:text-ink'
const LIST = 'flex gap-1 border-b border-line'

function CountBadge({ count }: { count: number }) {
  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-on-solid">
      {count}
    </span>
  )
}

// ── Link tabs ──────────────────────────────────────────────────────────────
// Pathname-driven section nav. Replaces the hand-rolled team-tabs / bookings-tabs.

export interface LinkTabItem {
  href: string
  label: string
}

export function LinkTabs({
  items,
  className,
}: {
  items: LinkTabItem[]
  className?: string
}) {
  const pathname = usePathname()
  return (
    <div className={cn(LIST, className)}>
      {items.map(({ href, label }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={cn(TAB_BASE, active ? TAB_ACTIVE : TAB_INACTIVE)}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}

// ── Controlled tabs ────────────────────────────────────────────────────────
// In-component view switching (e.g. conversation filters / thread tabs).

export interface TabItem<K extends string> {
  key: K
  label: string
  count?: number
}

export function Tabs<K extends string>({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem<K>[]
  active: K
  onChange: (key: K) => void
  className?: string
}) {
  return (
    <div className={cn(LIST, className)}>
      {items.map(({ key, label, count }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(TAB_BASE, key === active ? TAB_ACTIVE : TAB_INACTIVE)}
        >
          {label}
          {count != null && count > 0 && <CountBadge count={count} />}
        </button>
      ))}
    </div>
  )
}
