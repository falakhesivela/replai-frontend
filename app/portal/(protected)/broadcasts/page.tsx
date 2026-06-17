import { createClient } from '@/lib/supabase/server'
import BroadcastsView from './_components/broadcasts-view'
import type { Broadcast } from '@/lib/types'

export default async function BroadcastsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('broadcasts')
    .select('id, name, status, target_audience, message, total_recipients, sent_count, failed_count, scheduled_at, sent_at, created_at')
    .order('created_at', { ascending: false })

  return <BroadcastsView initialBroadcasts={(data ?? []) as Broadcast[]} />
}
