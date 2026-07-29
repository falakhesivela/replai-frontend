import { Skeleton, SkeletonRows } from '@/components/ui'

export default function BookingsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-44" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <SkeletonRows rows={6} />
    </div>
  )
}
