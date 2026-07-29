import { Skeleton, SkeletonCard } from '@/components/ui'

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Skeleton className="h-8 w-36" />
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
    </div>
  )
}
