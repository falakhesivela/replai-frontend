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
  const roleAllowedHrefs = role
    ? PORTAL_NAV_ACCESS.filter((item) => portalNavEntryAllowsRole(role, item)).map(
        (item) => item.href
      )
    : PORTAL_NAV_ACCESS.map((item) => item.href)

  const { data: ownerClient } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('user_id', user.id)
    .maybeSingle()

  let businessName = ownerClient?.business_name
  let clientId: string | null = ownerClient?.id ?? null

  if (!clientId) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (membership?.client_id) {
      clientId = membership.client_id
      const { data: teamClient } = await supabase
        .from('clients')
        .select('business_name')
        .eq('id', membership.client_id)
        .maybeSingle()
      businessName = teamClient?.business_name ?? undefined
    }
  }

  // Fetch enabled features so we can hide feature-gated nav items when the
  // addon is not active. Falls back to empty (hides feature items) on error.
  let enabledFeatures: string[] = []
  if (clientId) {
    const { data: featureRows } = await supabase
      .from('client_features')
      .select('plan_key')
      .eq('client_id', clientId)
      .eq('enabled', true)
    enabledFeatures = featureRows?.map((r: { plan_key: string }) => r.plan_key) ?? []
  }

  // Hrefs that require a specific addon to be enabled.
  const FEATURE_GATED: Record<string, string[]> = {
    bookings:  ['/portal/bookings', '/portal/my-bookings'],
    broadcasts: ['/portal/broadcasts'],
    ecommerce: ['/portal/ecommerce/products', '/portal/ecommerce/orders'],
  }

  const allowedHrefs = Object.entries(FEATURE_GATED).reduce(
    (hrefs, [feature, gated]) =>
      enabledFeatures.includes(feature) ? hrefs : hrefs.filter((h) => !gated.includes(h)),
    roleAllowedHrefs
  )

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
