import { Skeleton, SkeletonRows } from '@/components/ui'

export default function TeamLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-9 w-72" />
      <SkeletonRows rows={5} />
    </div>
  )
}
