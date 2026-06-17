import { redirect } from 'next/navigation'
import { getClientProfile, createClient } from '@/lib/supabase/server'
import LeadsView from './_components/leads-view'
import type { Lead } from '@/lib/types'

export default async function LeadsPage() {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  return <LeadsView initialLeads={(data ?? []) as Lead[]} />
}
