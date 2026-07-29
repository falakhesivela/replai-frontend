import { Skeleton, SkeletonRows } from '@/components/ui'

export default function LeadsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Skeleton className="h-8 w-40" />
      <SkeletonRows rows={6} />
    </div>
  )
}
