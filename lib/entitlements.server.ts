import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, getClientProfile } from '@/lib/supabase/server'
import {
  isFeatureAvailable,
  type Channel,
  type EntitlementInput,
  type FeatureKey,
} from '@/lib/entitlements'

/** Read the single trial_config row (RLS allows authenticated reads). */
export async function getTrialConfig(
  supabase: SupabaseClient
): Promise<{ channels: Channel[]; addons: string[] }> {
  const { data } = await supabase
    .from('trial_config')
    .select('channels, addons')
    .maybeSingle()
  return {
    channels: (data?.channels as Channel[] | null) ?? [],
    addons: (data?.addons as string[] | null) ?? [],
  }
}

/** Build an EntitlementInput from a subscription row + supabase client,
 *  resolving the trial config when on the trial plan. Shared by the layout
 *  and per-page gates so the rules can't drift. */
export async function buildEntitlementInput(
  supabase: SupabaseClient,
  clientId: string,
  planKey: string | null
): Promise<EntitlementInput> {
  if (planKey === 'trial') {
    const trial = await getTrialConfig(supabase)
    return { planKey, enabledAddons: [], trialChannels: trial.channels, trialAddons: trial.addons }
  }
  const { data: featureRows } = await supabase
    .from('client_features')
    .select('plan_key')
    .eq('client_id', clientId)
    .eq('enabled', true)
  return {
    planKey,
    enabledAddons:
      (featureRows as { plan_key: string }[] | null)?.map((r) => r.plan_key) ?? [],
  }
}

/** Resolve the current client's entitlement inputs (plan + add-ons). */
export async function getClientEntitlementInput(): Promise<EntitlementInput | null> {
  const client = await getClientProfile()
  if (!client) return null

  const supabase = await createClient()
  const { data: sub } = await supabase
    .from('client_subscriptions')
    .select('plan_key')
    .eq('client_id', client.id)
    .maybeSingle()

  return buildEntitlementInput(supabase, client.id, sub?.plan_key ?? null)
}

/** Server-side gate for a feature page. Returns false when not unlocked. */
export async function isFeatureUnlocked(feature: FeatureKey): Promise<boolean> {
  const input = await getClientEntitlementInput()
  if (!input) return false
  return isFeatureAvailable(feature, input)
}
