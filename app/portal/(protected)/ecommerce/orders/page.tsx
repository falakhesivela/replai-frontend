import { redirect } from 'next/navigation'
import { getEffectivePortalRole } from '@/lib/team-auth'
import { isFeatureUnlocked } from '@/lib/entitlements.server'
import FeatureLocked from '../../_components/feature-locked'
import OrdersView from './_components/orders-view'

export default async function OrdersPage() {
  const role = await getEffectivePortalRole()
  if (!role || (role !== 'owner' && role !== 'manager')) {
    redirect('/portal/overview')
  }

  if (!(await isFeatureUnlocked('shopping'))) {
    return <FeatureLocked feature="shopping" />
  }

  return <OrdersView role={role} />
}
