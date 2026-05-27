// ── Feature entitlements ──────────────────────────────────────────────────────
// Single source of truth for "which features does this subscription unlock".
// Mirrored in the backend at replai/app/core/entitlements.py — keep them in sync.
//
// Two dimensions decide access:
//   1. Channel plan (plan_key): website | whatsapp | both | scale.
//   2. Toggleable add-ons (client_features): bookings | shopping | broadcasts.
// `scale` includes every channel and every add-on.

export type FeatureKey = 'website_widget' | 'broadcasts' | 'bookings' | 'shopping'

export type Channel = 'website' | 'whatsapp'

/** Channels each channel-plan includes. */
const PLAN_CHANNELS: Record<string, readonly Channel[]> = {
  website: ['website'],
  whatsapp: ['whatsapp'],
  both: ['website', 'whatsapp'],
  scale: ['website', 'whatsapp'],
}

/** Add-ons that only make sense on a given channel (e.g. WhatsApp broadcasts). */
const FEATURE_REQUIRES_CHANNEL: Partial<Record<FeatureKey, Channel>> = {
  website_widget: 'website',
  broadcasts: 'whatsapp',
}

/** Add-ons gated by a client_features toggle (channel features are not). */
const FEATURE_ADDON_KEY: Partial<Record<FeatureKey, string>> = {
  bookings: 'bookings',
  shopping: 'shopping',
  broadcasts: 'broadcasts',
}

/** Map a portal route to the feature that unlocks it. Routes absent here are core. */
export const FEATURE_ROUTES: Record<string, FeatureKey> = {
  '/portal/chatbot-widget': 'website_widget',
  '/portal/broadcasts': 'broadcasts',
  '/portal/bookings': 'bookings',
  '/portal/my-bookings': 'bookings',
  '/portal/setup': 'bookings',
  '/portal/ecommerce/products': 'shopping',
  '/portal/ecommerce/orders': 'shopping',
}

export const ALL_FEATURES: readonly FeatureKey[] = [
  'website_widget',
  'broadcasts',
  'bookings',
  'shopping',
]

/** Display copy for the locked/upsell view. */
export const FEATURE_META: Record<FeatureKey, { label: string; description: string }> = {
  website_widget: {
    label: 'Website widget',
    description: 'The AI agent on your website chat widget. Available on the Website or Both plans.',
  },
  broadcasts: {
    label: 'Broadcast campaigns',
    description: 'Targeted WhatsApp sends with scheduling and stats. Requires a WhatsApp channel plus the Broadcasts add-on.',
  },
  bookings: {
    label: 'Bookings',
    description: 'Services, availability, reminders and calendar sync. Add the Bookings module to unlock.',
  },
  shopping: {
    label: 'Shopping',
    description: 'Product catalogue, orders and payment links in chat. Add the Shopping module to unlock.',
  },
}

export interface EntitlementInput {
  /** Chosen plan: 'trial' during the trial, a channel plan once subscribed,
   *  or null/undefined when there's no subscription. */
  planKey: string | null | undefined
  /** Add-on keys enabled in client_features (used by paid plans). */
  enabledAddons: readonly string[]
  /** Trial-only: channels granted by the admin trial config. */
  trialChannels?: readonly Channel[]
  /** Trial-only: add-ons granted by the admin trial config. */
  trialAddons?: readonly string[]
}

/** Whether a single feature is unlocked for this subscription.
 *
 * planKey === 'trial' resolves channels/add-ons from the admin trial config;
 * a paid planKey uses its fixed channels + the client's enabled add-ons;
 * no planKey means no access. */
export function isFeatureAvailable(feature: FeatureKey, input: EntitlementInput): boolean {
  const planKey = input.planKey

  let channels: readonly Channel[]
  let grantedAddons: readonly string[]
  let isScale = false

  if (planKey === 'trial') {
    channels = input.trialChannels ?? []
    grantedAddons = input.trialAddons ?? []
  } else if (!planKey) {
    return false
  } else {
    channels = PLAN_CHANNELS[planKey] ?? []
    grantedAddons = input.enabledAddons
    isScale = planKey === 'scale'
  }

  const requiredChannel = FEATURE_REQUIRES_CHANNEL[feature]
  if (requiredChannel && !channels.includes(requiredChannel)) return false

  const addonKey = FEATURE_ADDON_KEY[feature]
  if (addonKey && !isScale && !grantedAddons.includes(addonKey)) return false

  return true
}

/** The set of all features this subscription unlocks. */
export function grantedFeatures(input: EntitlementInput): Set<FeatureKey> {
  return new Set(ALL_FEATURES.filter((f) => isFeatureAvailable(f, input)))
}

/**
 * Of the role-allowed hrefs, which are locked behind a feature the subscription
 * doesn't have. These stay visible in the nav (shown with a lock + upsell).
 */
export function lockedHrefs(
  roleAllowedHrefs: readonly string[],
  input: EntitlementInput
): string[] {
  return roleAllowedHrefs.filter((href) => {
    const feature = FEATURE_ROUTES[href]
    return feature ? !isFeatureAvailable(feature, input) : false
  })
}

/** The feature that gates a route, if any (for page-level checks). */
export function featureForHref(href: string): FeatureKey | null {
  return FEATURE_ROUTES[href] ?? null
}
