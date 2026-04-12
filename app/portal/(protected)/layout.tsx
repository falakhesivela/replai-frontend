import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PortalShell from '../_components/portal-shell'
import { ToastProvider } from '@/components/toast'
import { getCurrentTeamMember, getEffectivePortalRole } from '@/lib/team-auth'
import { PORTAL_NAV_ACCESS, portalNavEntryAllowsRole } from '@/lib/portal-nav'

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/portal/login')
  }

  const role = await getEffectivePortalRole()
  const allowedHrefs = role
    ? PORTAL_NAV_ACCESS.filter((item) => portalNavEntryAllowsRole(role, item)).map(
        (item) => item.href
      )
    : PORTAL_NAV_ACCESS.map((item) => item.href)

  const { data: ownerClient } = await supabase
    .from('clients')
    .select('business_name')
    .eq('user_id', user.id)
    .maybeSingle()

  let businessName = ownerClient?.business_name

  if (!businessName) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (membership?.client_id) {
      const { data: teamClient } = await supabase
        .from('clients')
        .select('business_name')
        .eq('id', membership.client_id)
        .maybeSingle()
      businessName = teamClient?.business_name ?? undefined
    }
  }

  const teamMember = await getCurrentTeamMember()

  return (
    <ToastProvider>
      <PortalShell
        businessName={businessName ?? 'My Business'}
        email={user.email ?? ''}
        allowedHrefs={allowedHrefs}
        teamMemberId={teamMember?.id ?? null}
      >
        {children}
      </PortalShell>
    </ToastProvider>
  )
}
