'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle size={22} className="text-red-500" strokeWidth={1.5} />
      </div>
      <h2 className="text-sm font-semibold text-gray-900">Something went wrong</h2>
      <p className="mt-1 text-sm text-gray-500">
        {error.message ?? 'An unexpected error occurred.'}
      </p>
      {error.digest && (
        <p className="mt-1 font-mono text-xs text-gray-400">Error ID: {error.digest}</p>
      )}
      <button
        onClick={unstable_retry}
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <RotateCcw size={13} strokeWidth={2} />
        Try again
      </button>
    </div>
  )
}
