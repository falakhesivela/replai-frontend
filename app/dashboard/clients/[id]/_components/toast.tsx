'use client'

import { useEffect } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

export type ToastData = { message: string; type: 'success' | 'error' }

interface ToastProps extends ToastData {
  onDismiss: () => void
}

export function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
        type === 'success' ? 'bg-gray-900' : 'bg-red-600'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle size={15} strokeWidth={2} />
      ) : (
        <XCircle size={15} strokeWidth={2} />
      )}
      {message}
    </div>
  )
}
