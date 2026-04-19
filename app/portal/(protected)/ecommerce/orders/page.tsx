import { redirect } from 'next/navigation'
import { getEffectivePortalRole } from '@/lib/team-auth'
import OrdersView from './_components/orders-view'

export default async function OrdersPage() {
  const role = await getEffectivePortalRole()
  if (!role || (role !== 'owner' && role !== 'manager')) {
    redirect('/portal/overview')
  }

  return <OrdersView role={role} />
}
