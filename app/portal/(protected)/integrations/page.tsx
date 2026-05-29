import { redirect } from 'next/navigation'
import { getEffectivePortalRole } from '@/lib/team-auth'
import IntegrationsView from './_components/integrations-view'

export default async function IntegrationsPage() {
  const role = await getEffectivePortalRole()
  if (role !== 'owner') {
    redirect('/portal/overview')
  }

  return <IntegrationsView />
}
