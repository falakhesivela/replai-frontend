'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { Loader2 } from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { completeWhatsAppEmbeddedSignup, type TokenGetter } from '@/lib/api'
import type { WhatsAppConnectionStatus } from '@/lib/types'
import { buttonClasses } from '@/components/ui'

// Minimal shape of the global Facebook JS SDK we rely on.
type FBLoginResponse = {
  authResponse?: { code?: string } | null
  status?: string
}
type FB = {
  init: (params: Record<string, unknown>) => void
  login: (
    cb: (resp: FBLoginResponse) => void,
    opts: Record<string, unknown>
  ) => void
}
declare global {
  interface Window {
    FB?: FB
    fbAsyncInit?: () => void
  }
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID
const CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID
const GRAPH_VERSION = process.env.NEXT_PUBLIC_META_GRAPH_VERSION || 'v23.0'

const getFreshToken: TokenGetter = async () => {
  const supabase = createSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export default function WhatsAppEmbeddedSignup({
  onConnected,
  onError,
  onCancel,
  variant = 'primary',
  label = 'Connect with WhatsApp',
}: {
  onConnected: (status: WhatsAppConnectionStatus) => void
  onError?: (message: string) => void
  /** Called when the user closes Meta's popup without finishing. */
  onCancel?: () => void
  variant?: 'primary' | 'secondary'
  label?: string
}) {
  const [sdkReady, setSdkReady] = useState(false)
  const [sdkBlocked, setSdkBlocked] = useState(false)
  const [busy, setBusy] = useState(false)

  // Embedded Signup delivers the WABA (+ phone-number id when present) via a
  // postMessage and the authorization code via the FB.login callback —
  // independently. Stash both and submit once we have the code + waba_id.
  // Coexistence finish events sometimes omit phone_number_id; the backend
  // resolves it from the WABA in that case.
  const sessionRef = useRef<{
    waba_id?: string
    phone_number_id?: string
    coexistence?: boolean
  }>({})

  // Keep the latest onCancel in a ref so the postMessage listener (registered
  // once) always calls the current callback without re-subscribing.
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  const submit = useCallback(
    async (code: string) => {
      // The waba_id arrives via postMessage and the code via the FB.login
      // callback — independently, in no guaranteed order. Wait briefly for the
      // session info instead of failing a signup the user just completed.
      let session = sessionRef.current
      const deadline = Date.now() + 3000
      while (!session.waba_id && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100))
        session = sessionRef.current
      }
      const { waba_id, phone_number_id, coexistence } = session
      if (!waba_id || (!coexistence && !phone_number_id)) {
        setBusy(false)
        onError?.('WhatsApp did not return the account details. Please try again.')
        return
      }
      try {
        const status = await completeWhatsAppEmbeddedSignup(getFreshToken, {
          code,
          waba_id,
          ...(phone_number_id ? { phone_number_id } : {}),
          ...(coexistence ? { coexistence: true } : {}),
        })
        onConnected(status)
      } catch (err) {
        onError?.(
          err instanceof Error ? err.message : 'Could not finish connecting WhatsApp.'
        )
      } finally {
        setBusy(false)
        sessionRef.current = {}
      }
    },
    [onConnected, onError]
  )

  // Capture the session info Meta posts back during the signup flow.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      let hostname: string
      try {
        hostname = new URL(event.origin).hostname
      } catch {
        return
      }
      if (!/(^|\.)facebook\.com$/.test(hostname)) return
      try {
        const parsed = JSON.parse(event.data)
        if (parsed?.type !== 'WA_EMBEDDED_SIGNUP') return
        const isCoexistence =
          parsed.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
        if (
          (parsed.event === 'FINISH' || isCoexistence) &&
          parsed.data
        ) {
          sessionRef.current = {
            waba_id: parsed.data.waba_id,
            phone_number_id: parsed.data.phone_number_id,
            coexistence: isCoexistence,
          }
        } else if (parsed.event === 'CANCEL') {
          setBusy(false)
          onCancelRef.current?.()
        }
      } catch {
        // Non-JSON cross-origin chatter — ignore.
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const initFB = useCallback(() => {
    if (!window.FB || !APP_ID) return
    window.FB.init({
      appId: APP_ID,
      autoLogAppEvents: true,
      xfbml: false,
      version: GRAPH_VERSION,
    })
    setSdkReady(true)
    setSdkBlocked(false)
  }, [])

  // Ad blockers commonly kill connect.facebook.net — without this the button
  // would just sit disabled forever with no explanation.
  useEffect(() => {
    if (sdkReady) return
    const timer = setTimeout(() => {
      if (!window.FB) setSdkBlocked(true)
    }, 8000)
    return () => clearTimeout(timer)
  }, [sdkReady])

  function handleClick() {
    if (!window.FB || !CONFIG_ID) {
      onError?.('WhatsApp signup is not available right now.')
      return
    }
    setBusy(true)
    sessionRef.current = {}
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code
        if (code) {
          submit(code)
        } else {
          // No code → the user closed the popup or did not authorize.
          setBusy(false)
          onCancelRef.current?.()
        }
      },
      {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        // whatsapp_business_app_onboarding = coexistence: keep using the
        // WhatsApp Business app on the same number while connecting Cloud API.
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      }
    )
  }

  // Missing public config → render nothing; the parent shows a fallback.
  if (!APP_ID || !CONFIG_ID) return null

  return (
    <>
      <Script
        id="facebook-jssdk"
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onLoad={initFB}
        onReady={initFB}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || !sdkReady}
        className={buttonClasses({ variant })}
      >
        {busy ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Connecting…
          </>
        ) : (
          label
        )}
      </button>
      {sdkBlocked && !sdkReady && (
        <p className="max-w-55 text-right text-xs leading-relaxed text-warning">
          Your browser is blocking Facebook&apos;s signup script (often an ad
          blocker). Allow it for this page, or enter credentials manually.
        </p>
      )}
    </>
  )
}

/** Whether the public Meta env vars are present (so callers can decide whether
 * to render the Embedded Signup button or a manual fallback). */
export const whatsappEmbeddedSignupConfigured = Boolean(APP_ID && CONFIG_ID)
