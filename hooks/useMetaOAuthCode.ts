'use client'

import { useCallback, useEffect, useState } from 'react'

// Facebook Login for Business popup for configurations that are NOT WhatsApp
// Embedded Signup — currently the catalog-only configuration. Embedded Signup
// has its own component (components/whatsapp-embedded-signup.tsx) because it
// additionally listens for Meta's WA_EMBEDDED_SIGNUP postMessage; this flow
// only needs the authorization code from the FB.login callback.

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID
const GRAPH_VERSION = process.env.NEXT_PUBLIC_META_GRAPH_VERSION || 'v23.0'
const SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js'

let sdkPromise: Promise<void> | null = null

function loadSdk(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.FB) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_SRC}"]`
    )
    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => resolve())
    // Ad blockers routinely kill connect.facebook.net.
    script.addEventListener('error', () =>
      reject(new Error('Could not load Facebook. Disable your ad blocker and retry.'))
    )
    if (!existing) {
      script.src = SDK_SRC
      script.async = true
      script.crossOrigin = 'anonymous'
      document.body.appendChild(script)
    }
  })
  return sdkPromise
}

/**
 * Returns `requestCode(configId)` — opens Meta's consent popup and resolves
 * with the authorization code, or null when the user closes it without
 * granting. Rejects only when the SDK itself is unavailable.
 */
export function useMetaOAuthCode() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!APP_ID) return
    let cancelled = false
    loadSdk()
      .then(() => {
        if (cancelled || !window.FB) return
        window.FB.init({
          appId: APP_ID,
          autoLogAppEvents: true,
          xfbml: false,
          version: GRAPH_VERSION,
        })
        setReady(true)
      })
      .catch(() => {
        /* surfaced by requestCode when the user clicks */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const requestCode = useCallback(
    (configId: string) =>
      new Promise<string | null>((resolve, reject) => {
        if (!window.FB || !APP_ID || !configId) {
          reject(new Error('Meta login is not available right now.'))
          return
        }
        window.FB.login(
          (response) => resolve(response.authResponse?.code ?? null),
          {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
          }
        )
      }),
    []
  )

  return { ready, requestCode }
}
