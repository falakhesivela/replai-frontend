import { redirect } from 'next/navigation'
import { getClientProfile, createClient } from '@/lib/supabase/server'
import SetupForm from './_components/setup-form'
import type { AvailabilitySchedule, Service } from '@/lib/types'

export default async function SetupPage() {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  const supabase = await createClient()
  const [{ data: servicesData }, { data: availData }] = await Promise.all([
    supabase
      .from('services')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('availability')
      .select('*')
      .eq('client_id', client.id)
      .order('day_of_week', { ascending: true }),
  ])

  return (
    <SetupForm
      initialServices={(servicesData ?? []) as Service[]}
      initialAvailability={(availData ?? []) as AvailabilitySchedule[]}
    />
  )
}
