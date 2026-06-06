'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Loader2,
  Star,
  TriangleAlert,
} from 'lucide-react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import {
  disconnectMyCalendar,
  getMyCalendarStatus,
  setMyCalendarBusinessDefault,
  startCalendarConnect,
  type TokenGetter,
} from '@/lib/api'
import type { CalendarConnectionStatus } from '@/lib/types'
import { useToast } from '@/components/toast'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, buttonClasses } from '@/components/ui'

const getFreshToken: TokenGetter = async () => {
  const supabase = createSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export default function GoogleCalendarView({
  returnStatus,
  returnReason,
}: {
  returnStatus: string | null
  returnReason: string | null
}) {
  const { toast } = useToast()
  const { can } = usePermissions()
  const router = useRouter()
  const canManageSettings = can('manage_settings')

  const [status, setStatus] = useState<CalendarConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await getMyCalendarStatus(getFreshToken))
    } catch {
      toast.error('Could not load your Google Calendar connection.')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // Surface the OAuth callback result once, then strip the query params so a
  // refresh doesn't re-toast.
  const handledReturn = useRef(false)
  useEffect(() => {
    if (handledReturn.current || !returnStatus) return
    handledReturn.current = true
    if (returnStatus === 'connected') {
      toast.success('Google Calendar connected.')
    } else {
      toast.error(
        returnReason === 'no_refresh_token'
          ? 'Google didn’t return access. Try connecting again.'
          : 'Could not connect Google Calendar. Please try again.'
      )
    }
    router.replace('/portal/integrations/google-calendar')
  }, [returnStatus, returnReason, toast, router])

  async function handleConnect() {
    setConnecting(true)
    try {
      const { auth_url } = await startCalendarConnect(getFreshToken)
      window.location.href = auth_url // hand off to Google's consent screen
    } catch (err) {
      setConnecting(false)
      toast.error(
        err instanceof Error ? err.message : 'Could not start Google Calendar connection.'
      )
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await disconnectMyCalendar(getFreshToken)
      toast.success('Google Calendar disconnected.')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not disconnect.')
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleSetDefault() {
    setSettingDefault(true)
    try {
      setStatus(await setMyCalendarBusinessDefault(getFreshToken))
      toast.success('This calendar is now the default for unassigned bookings.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not set default.')
    } finally {
      setSettingDefault(false)
    }
  }

  const connected = status?.connected === true
  const revoked = status?.status === 'revoked'

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <Link
          href="/portal/integrations"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={14} />
          Integrations
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Google Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sync confirmed bookings to your own Google Calendar. Each person connects
          their own account — a booking lands on the assigned team member’s calendar,
          falling back to the default calendar for unassigned bookings.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !status?.configured ? (
        <Card>
          <div className="flex items-start gap-3">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm text-gray-600">
              Google Calendar isn’t enabled on this Replai environment yet. Once the
              server is configured with Google credentials, you’ll be able to connect
              here.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100">
              <Calendar size={18} className="text-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Connection status</p>

              {connected ? (
                <div className="mt-2 space-y-2 text-sm text-gray-600">
                  <p className="inline-flex items-center gap-1.5 text-green-700">
                    <CheckCircle2 size={14} />
                    Connected{status?.google_account_email ? ` as ${status.google_account_email}` : ''}
                  </p>
                  {status?.is_business_default && (
                    <p className="inline-flex items-center gap-1.5 text-gray-500">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      Default calendar for unassigned bookings
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {canManageSettings && !status?.is_business_default && (
                      <button
                        onClick={handleSetDefault}
                        disabled={settingDefault}
                        className={buttonClasses({ variant: 'secondary' })}
                      >
                        {settingDefault ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Saving…
                          </>
                        ) : (
                          'Make default calendar'
                        )}
                      </button>
                    )}
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className={buttonClasses({ variant: 'secondary' })}
                    >
                      {disconnecting ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Disconnecting…
                        </>
                      ) : (
                        'Disconnect'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 space-y-3">
                  {revoked ? (
                    <p className="inline-flex items-center gap-1.5 text-sm text-amber-700">
                      <TriangleAlert size={14} />
                      Access was revoked — reconnect to resume syncing.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Connect your Google account to start syncing your bookings.
                    </p>
                  )}
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className={buttonClasses({ variant: 'primary' })}
                  >
                    {connecting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Redirecting…
                      </>
                    ) : revoked ? (
                      'Reconnect Google Calendar'
                    ) : (
                      'Connect Google Calendar'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
