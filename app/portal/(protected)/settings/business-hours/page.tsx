import { redirect } from 'next/navigation'
import { createClient, getClientProfile } from '@/lib/supabase/server'
import { getMyBusinessHours, getMyClosedDates, getAfterHoursMessages } from '@/lib/api'
import BusinessHoursForm from './_components/business-hours-form'

export default async function BusinessHoursPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/portal/login')

  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''

  const [businessHours, closedDates, afterHoursMessages] = await Promise.all([
    getMyBusinessHours(token).catch(() => []),
    getMyClosedDates(token).catch(() => []),
    getAfterHoursMessages(token).catch(() => []),
  ])

  return (
    <BusinessHoursForm
      client={client}
      initialBusinessHours={businessHours}
      initialClosedDates={closedDates}
      initialAfterHoursMessages={afterHoursMessages}
    />
  )
}
