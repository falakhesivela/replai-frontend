
import { Card } from '@/components/ui'

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-pulse">
      <div className="h-5 w-24 rounded bg-gray-200" />

      {/* Account card skeleton */}
      <Card className="space-y-4">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-9 w-full rounded-md bg-gray-100" />
      </Card>

      {/* Password card skeleton */}
      <Card className="space-y-4">
        <div className="h-4 w-36 rounded bg-gray-200" />
        <div className="h-3 w-56 rounded bg-gray-100" />
        <div className="h-9 w-full rounded-md bg-gray-100" />
        <div className="h-9 w-full rounded-md bg-gray-100" />
        <div className="flex justify-end">
          <div className="h-9 w-36 rounded-md bg-gray-200" />
        </div>
      </Card>
    </div>
  )
}
