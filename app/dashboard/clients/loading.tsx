export default function ClientsLoading() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-6 w-24 rounded bg-gray-200 animate-pulse" />
        <div className="h-9 w-28 rounded-md bg-gray-200 animate-pulse" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-5 gap-4 border-b border-gray-100 bg-gray-50 px-6 py-3">
          {['Business name', 'WhatsApp number', 'Status', 'Created', 'Actions'].map((col) => (
            <div key={col} className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
          ))}
        </div>

        {/* Body rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 border-b border-gray-100 px-6 py-4 last:border-0">
            <div className="h-4 w-36 rounded bg-gray-100 animate-pulse" />
            <div className="h-4 w-28 rounded bg-gray-100 animate-pulse" />
            <div className="h-5 w-16 rounded-full bg-gray-100 animate-pulse" />
            <div className="h-4 w-24 rounded bg-gray-100 animate-pulse" />
            <div className="h-7 w-16 rounded-md bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
