'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import { CheckCircle, Info, X, XCircle } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

let idCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // Track pending timers so manual dismiss can cancel them
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType) => {
      const id = ++idCounter
      setToasts((prev) => [...prev, { id, message, type }])
      const timer = setTimeout(() => dismiss(id), 4000)
      timers.current.set(id, timer)
    },
    [dismiss]
  )

  const toast = useMemo(
    () => ({
      success: (message: string) => addToast(message, 'success'),
      error: (message: string) => addToast(message, 'error'),
      info: (message: string) => addToast(message, 'info'),
    }),
    [addToast]
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ─── Styles per type ─────────────────────────────────────────────────────────

const STYLES: Record<
  ToastType,
  { container: string; icon: React.ReactNode }
> = {
  success: {
    container: 'bg-green-600 text-white',
    icon: <CheckCircle size={16} strokeWidth={2} aria-hidden />,
  },
  error: {
    container: 'bg-red-600 text-white',
    icon: <XCircle size={16} strokeWidth={2} aria-hidden />,
  },
  info: {
    container: 'bg-blue-600 text-white',
    icon: <Info size={16} strokeWidth={2} aria-hidden />,
  },
}

// ─── Individual toast ─────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem
  onDismiss: (id: number) => void
}) {
  const { container, icon } = STYLES[toast.type]

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg ${container} w-80 max-w-full`}
    >
      <span className="mt-px shrink-0">{icon}</span>
      <p className="flex-1 text-sm leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/50 transition-opacity"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── Container ───────────────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
