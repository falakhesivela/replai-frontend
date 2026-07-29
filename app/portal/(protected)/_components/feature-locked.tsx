import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Card, buttonClasses } from '@/components/ui'
import { FEATURE_META, type FeatureKey } from '@/lib/entitlements'

/**
 * Shown in place of a feature page the client's subscription doesn't unlock.
 * Surfaces what the feature is and links to the subscription page (upsell).
 */
export default function FeatureLocked({ feature }: { feature: FeatureKey }) {
  const meta = FEATURE_META[feature]

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-16 text-center">
      <Card padding="md" className="w-full">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
          <Lock size={20} className="text-ink-2" />
        </div>
        <h1 className="text-lg font-semibold text-ink">
          {meta.label} is not on your plan
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-2">{meta.description}</p>
        <Link
          href={`/portal/subscription?feature=${feature}`}
          className={`${buttonClasses({ variant: 'primary' })} mt-6 inline-flex`}
        >
          View plans &amp; add-ons
        </Link>
      </Card>
    </div>
  )
}
