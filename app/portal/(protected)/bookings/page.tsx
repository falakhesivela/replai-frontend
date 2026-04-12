import { redirect } from 'next/navigation'
import { getClientProfile, createClient } from '@/lib/supabase/server'
import BookingsView from './_components/bookings-view'
import type { Booking } from '@/lib/types'

export default async function BookingsPage() {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  const supabase = await createClient()
  const { data } = await supabase
    .from('bookings')
    .select('*, services(name, duration_minutes)')
    .eq('client_id', client.id)
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true })

  return (
    <BookingsView
      initialBookings={(data ?? []) as Booking[]}
      clientId={client.id}
    />
  )
}
