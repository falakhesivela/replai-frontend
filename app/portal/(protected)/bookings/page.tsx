import { redirect } from 'next/navigation'
import { getClientProfile, createClient } from '@/lib/supabase/server'
import BookingsView from './_components/bookings-view'
import type { Booking } from '@/lib/types'

export default async function BookingsPage() {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  const supabase = await createClient()
  const [{ data: bookings }, { data: roles }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, services(name, duration_minutes), assigned_member:team_members!assigned_to(id, name, avatar_color, role, custom_role_id)')
      .eq('client_id', client.id)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true }),
    supabase
      .from('client_roles')
      .select('id, name')
      .eq('client_id', client.id),
  ])

  const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.id, r.name]))
  const resolved = (bookings ?? []).map((b) => {
    if (b.assigned_member) {
      const crId = b.assigned_member.custom_role_id
      b.assigned_member.role_label = crId ? (roleMap[crId] ?? null) : null
      delete b.assigned_member.custom_role_id
    }
    return b
  })

  return (
    <BookingsView
      initialBookings={resolved as Booking[]}
      clientId={client.id}
    />
  )
}
