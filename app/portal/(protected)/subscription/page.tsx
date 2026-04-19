import { redirect } from 'next/navigation'
import { getEffectivePortalRole } from '@/lib/team-auth'
import SubscriptionView from './_components/subscription-view'

export default async function SubscriptionPage() {
  const role = await getEffectivePortalRole()
  if (role !== 'owner') {
    redirect('/portal/overview')
  }

  return <SubscriptionView />
}
