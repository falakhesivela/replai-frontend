'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from './cn'

interface DropdownMenuProps {
  /** The element that toggles the menu (rendered inside a button-less wrapper). */
  trigger: React.ReactNode
  /** Menu contents — use DropdownItem for entries. */
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}

/** Click-to-open menu panel with click-outside + esc close. */
export function DropdownMenu({
  trigger,
  children,
  align = 'right',
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cn(
            'absolute z-40 mt-1 min-w-44 rounded-lg border border-line bg-overlay p-1 shadow-overlay',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface DropdownItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'default' | 'danger'
}

export function DropdownItem({
  tone = 'default',
  className,
  ...props
}: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
        tone === 'danger'
          ? 'text-danger hover:bg-danger-soft'
          : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        className
      )}
      {...props}
    />
  )
}
