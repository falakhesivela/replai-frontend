import { redirect } from 'next/navigation'
import { getClientProfile, getPortalAccessToken } from '@/lib/supabase/server'
import { getMyOnboarding } from '@/lib/api'
import { isFeatureUnlocked } from '@/lib/entitlements.server'
import type { OnboardingStatus } from '@/lib/types'
import OnboardingView from './_components/onboarding-view'

export default async function OnboardingPage() {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  const token = (await getPortalAccessToken()) ?? ''

  let status: OnboardingStatus | null = null
  if (token) {
    try {
      status = await getMyOnboarding(token)
    } catch {
      // Backend not migrated yet — render with everything pending.
    }
  }

  const hasWidget = await isFeatureUnlocked('website_widget')

  return <OnboardingView initialStatus={status} hasWidget={hasWidget} />
}
