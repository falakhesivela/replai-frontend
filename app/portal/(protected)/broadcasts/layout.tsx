import { redirect } from 'next/navigation'
import { getEffectivePortalRole } from '@/lib/team-auth'
import { isFeatureUnlocked } from '@/lib/entitlements.server'
import FeatureLocked from '../_components/feature-locked'

export default async function BroadcastsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = await getEffectivePortalRole()
  if (!role || (role !== 'owner' && role !== 'manager')) {
    redirect('/portal/overview')
  }

  if (!(await isFeatureUnlocked('broadcasts'))) {
    return <FeatureLocked feature="broadcasts" />
  }

  return children
}
