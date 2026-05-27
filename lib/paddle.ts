// Paddle Billing (v2) client-side loader. Inert until configured via
// NEXT_PUBLIC_PADDLE_CLIENT_TOKEN (+ NEXT_PUBLIC_PADDLE_ENV). When unset the
// portal falls back to "reserve plan, no charge" (pre-Paddle behaviour).

type PaddleCheckoutItem = { priceId: string; quantity: number }

export interface PaddleEvent {
  name: string
}

export interface PaddleApi {
  Environment: { set: (env: 'sandbox' | 'production') => void }
  Initialize: (opts: {
    token: string
    eventCallback?: (e: PaddleEvent) => void
  }) => void
  Checkout: {
    open: (opts: {
      items: PaddleCheckoutItem[]
      customer?: { email: string }
      customData?: Record<string, string>
    }) => void
  }
}

// Single global handler for Paddle.js events (e.g. checkout.completed).
let eventHandler: ((name: string) => void) | null = null

export function onPaddleEvent(fn: ((name: string) => void) | null): void {
  eventHandler = fn
}

declare global {
  interface Window {
    Paddle?: PaddleApi
  }
}

export function paddleConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
}

let loading: Promise<PaddleApi | null> | null = null

export function loadPaddle(): Promise<PaddleApi | null> {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
  if (!token || typeof window === 'undefined') return Promise.resolve(null)
  if (window.Paddle) return Promise.resolve(window.Paddle)
  if (loading) return loading

  loading = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    s.onload = () => {
      const P = window.Paddle
      if (!P) return resolve(null)
      P.Environment.set(
        process.env.NEXT_PUBLIC_PADDLE_ENV === 'production'
          ? 'production'
          : 'sandbox'
      )
      P.Initialize({
        token,
        eventCallback: (e) => eventHandler?.(e?.name),
      })
      resolve(P)
    }
    s.onerror = () => resolve(null)
    document.body.appendChild(s)
  })
  return loading
}
