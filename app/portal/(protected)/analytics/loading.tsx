import { Skeleton, SkeletonCard } from '@/components/ui'

export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Skeleton className="h-8 w-44" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    </div>
  )
}
