import { redirect } from 'next/navigation'
import { getClientProfile } from '@/lib/supabase/server'
import { isFeatureUnlocked } from '@/lib/entitlements.server'
import FeatureLocked from '../../_components/feature-locked'
import GoogleCalendarView from './_components/google-calendar-view'

export default async function GoogleCalendarIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string; reason?: string }>
}) {
  // Resolves for owners and active team members alike (per-member feature).
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  if (!(await isFeatureUnlocked('bookings'))) {
    return <FeatureLocked feature="bookings" />
  }

  const q = await searchParams
  return (
    <GoogleCalendarView
      returnStatus={q.calendar ?? null}
      returnReason={q.reason ?? null}
    />
  )
}
