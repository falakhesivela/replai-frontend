'use client'

import { Loader2, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'

export function isValidConfirmationEmail(email: string): boolean {
  const trimmed = email.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export function ConfirmationEmailModal({
  open,
  purpose,
  initialEmail,
  brandColor,
  onBrand,
  busy,
  onCancel,
  onSubmit,
}: {
  open: boolean
  purpose: 'checkout' | 'booking'
  initialEmail: string
  brandColor: string
  onBrand: string
  busy?: boolean
  onCancel: () => void
  onSubmit: (email: string) => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setEmail(initialEmail)
      setError(null)
    }
  }, [open, initialEmail])

  if (!open) return null

  const title =
    purpose === 'checkout' ? 'Email for your order' : 'Email for your booking'
  const subtitle =
    purpose === 'checkout'
      ? "We'll send your order confirmation and payment link to this address."
      : "We'll send your appointment confirmation to this address."

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidConfirmationEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    onSubmit(email.trim())
  }

  return (
    <div
      className="absolute inset-0 z-20 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-email-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-4 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${brandColor}22`, color: brandColor }}
          >
            <Mail size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirmation-email-title" className="text-sm font-semibold text-gray-900">
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="sr-only">Email address</span>
          <input
            type="email"
            required
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none"
          />
        </label>

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: brandColor, color: onBrand }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            Continue
          </button>
        </div>
      </form>
    </div>
  )
}
