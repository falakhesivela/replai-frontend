export default function ClientDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-5 w-48 rounded bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-100" />
        </div>
        <div className="h-5 w-16 rounded-full bg-gray-200" />
      </div>

      {/* AI Configuration skeleton */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div className="h-4 w-36 rounded bg-gray-200" />
        <div className="h-3 w-64 rounded bg-gray-100" />
        <div className="h-52 w-full rounded-md bg-gray-100" />
        <div className="flex justify-end">
          <div className="h-9 w-28 rounded-md bg-gray-200" />
        </div>
      </div>

      {/* Knowledge base skeleton */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-32 rounded bg-gray-200" />
            <div className="h-3 w-56 rounded bg-gray-100" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded-md bg-gray-100" />
          ))}
        </div>
        <div className="h-28 w-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50" />
      </div>
    </div>
  )
}
