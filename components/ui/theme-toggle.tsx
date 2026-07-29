'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme/theme-provider'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink ${className}`}
    >
      {theme === 'dark' ? (
        <Sun size={15} strokeWidth={1.75} />
      ) : (
        <Moon size={15} strokeWidth={1.75} />
      )}
    </button>
  )
}
