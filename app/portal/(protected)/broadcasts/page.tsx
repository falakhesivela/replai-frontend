import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEffectivePortalRole } from '@/lib/team-auth'
import BroadcastsView from './_components/broadcasts-view'
import type { Broadcast } from '@/lib/types'

export default async function BroadcastsPage() {
  const role = await getEffectivePortalRole()
  if (!role || (role !== 'owner' && role !== 'manager')) {
    redirect('/portal/overview')
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('broadcasts')
    .select('id, name, status, target_audience, message, total_recipients, sent_count, failed_count, scheduled_at, sent_at, created_at')
    .order('created_at', { ascending: false })

  return <BroadcastsView initialBroadcasts={(data ?? []) as Broadcast[]} />
}
