import { Skeleton, SkeletonCard } from '@/components/ui'

export default function OverviewLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  )
}
