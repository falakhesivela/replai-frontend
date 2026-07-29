'use client'

import { cn } from './cn'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

export function Switch({
  checked,
  onChange,
  disabled,
  className,
  ...aria
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-line-strong',
        className
      )}
      {...aria}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-[#ffffff] shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  )
}
