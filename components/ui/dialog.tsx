'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from './cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  /** Muted line under the title. */
  description?: string
  /** max-w-* class for the panel; defaults to max-w-md. */
  width?: string
  /** Hide the top-right close button. */
  hideClose?: boolean
  children: React.ReactNode
}

/**
 * Modal dialog: portal to body, overlay + esc close, initial focus.
 * Renders nothing when closed.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  width = 'max-w-md',
  hideClose = false,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Minimal focus trap: keep Tab cycling inside the panel.
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === panelRef.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-xl border border-line bg-overlay p-6 shadow-overlay outline-none',
          width
        )}
      >
        {!hideClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded p-0.5 text-ink-3 transition-colors hover:text-ink"
          >
            <X size={16} strokeWidth={2} />
          </button>
        )}
        {title && <h4 className="text-sm font-semibold text-ink">{title}</h4>}
        {description && (
          <p className="mt-1.5 text-sm text-ink-2">{description}</p>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}
