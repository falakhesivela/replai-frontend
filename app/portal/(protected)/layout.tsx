import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import PortalShell from '../_components/portal-shell'
import { ToastProvider } from '@/components/toast'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { getCurrentTeamMember, getEffectivePortalRole } from '@/lib/team-auth'
import { PORTAL_NAV_ACCESS, portalNavEntryAllowsRole } from '@/lib/portal-nav'
import SubscriptionPaywall from './_components/subscription-paywall'
import { lockedHrefs as computeLockedHrefs } from '@/lib/entitlements'
import { buildEntitlementInput } from '@/lib/entitlements.server'

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

  // ── Subscription gate + feature entitlements.
  // Read the subscription directly via RLS (like client_features above) rather
  // than through a server-side token + backend call — getSession() is unreliable
  // in Server Components and made the gate fail closed for valid trials.
  let lockedHrefs: string[] = []
  if (clientId) {
    const { data: sub } = await supabase
      .from('client_subscriptions')
      .select('status, trial_ends_at, plan_key')
      .eq('client_id', clientId)
      .maybeSingle()

    let entitled = false
    if (sub) {
      const trialOk =
        sub.status === 'trialing' &&
        (!sub.trial_ends_at ||
          new Date(sub.trial_ends_at).getTime() > Date.now())
      entitled = sub.status === 'active' || trialOk
    }

    if (!entitled) {
      const isOwner = !!ownerClient?.id && ownerClient.id === clientId
      return (
        <ThemeProvider>
          <ToastProvider>
            <SubscriptionPaywall isOwner={isOwner} />
          </ToastProvider>
        </ThemeProvider>
      )
    }

    // Feature-gated nav items the subscription doesn't unlock stay visible but
    // are shown locked with an upsell (see sidebar).
    const entInput = await buildEntitlementInput(supabase, clientId, sub?.plan_key ?? null)
    lockedHrefs = computeLockedHrefs(roleAllowedHrefs, entInput)
  }

  const allowedHrefs = roleAllowedHrefs

  const teamMember = await getCurrentTeamMember()

  // Server-read so the collapsed sidebar renders correctly on first paint.
  const cookieStore = await cookies()
  const initialCollapsed =
    cookieStore.get('portal_sidebar_collapsed')?.value === '1'

  return (
    <ThemeProvider>
      <ToastProvider>
        <PortalShell
          businessName={businessName ?? 'My Business'}
          email={user.email ?? ''}
          allowedHrefs={allowedHrefs}
          lockedHrefs={lockedHrefs}
          teamMemberId={teamMember?.id ?? null}
          initialCollapsed={initialCollapsed}
        >
          {children}
        </PortalShell>
      </ToastProvider>
    </ThemeProvider>
  )
}
