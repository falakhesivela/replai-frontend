import { redirect } from 'next/navigation'
import { getEffectivePortalRole } from '@/lib/team-auth'
import { portalPathForRole } from '@/lib/portal-login'

export default async function PortalPage() {
  const role = await getEffectivePortalRole()
  if (!role) {
    redirect('/portal/login')
  }
  redirect(portalPathForRole(role))
}
