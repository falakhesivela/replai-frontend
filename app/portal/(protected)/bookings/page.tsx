import { redirect } from 'next/navigation'
import { getClientProfile, createClient } from '@/lib/supabase/server'
import { isFeatureUnlocked } from '@/lib/entitlements.server'
import FeatureLocked from '../_components/feature-locked'
import BookingsTabs from './_components/bookings-tabs'
import BookingsView from './_components/bookings-view'
import type { Booking } from '@/lib/types'

export default async function BookingsPage() {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  if (!(await isFeatureUnlocked('bookings'))) {
    return <FeatureLocked feature="bookings" />
  }

  const supabase = await createClient()
  const [{ data: bookings }, { data: members }, { data: roles }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, services(name, duration_minutes), assigned_member:team_members!assigned_to(id, name, avatar_color, role)')
      .eq('client_id', client.id)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true }),
    supabase
      .from('team_members')
      .select('id, custom_role_id')
      .eq('client_id', client.id),
    supabase
      .from('client_roles')
      .select('id, name')
      .eq('client_id', client.id),
  ])

  const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.id, r.name]))
  const memberRoleMap = Object.fromEntries(
    (members ?? []).map((m) => [m.id, m.custom_role_id ? (roleMap[m.custom_role_id] ?? null) : null])
  )

  const resolved = (bookings ?? []).map((b) => {
    if (b.assigned_member) {
      b.assigned_member.role_label = memberRoleMap[b.assigned_member.id] ?? null
    }
    return b
  })

  return (
    <>
      <BookingsTabs />
      <BookingsView
        initialBookings={resolved as Booking[]}
        clientId={client.id}
      />
    </>
  )
}
