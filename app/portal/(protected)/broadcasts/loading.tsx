import { Skeleton, SkeletonRows } from '@/components/ui'

export default function BroadcastsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-44" />
      <SkeletonRows rows={5} />
    </div>
  )
}
