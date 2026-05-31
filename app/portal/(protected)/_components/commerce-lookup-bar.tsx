'use client'

import { Search } from 'lucide-react'

export function CommerceLookupBar({
  value,
  onChange,
  placeholder = 'Search by reference, name, phone, or email…',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Search
        size={14}
        strokeWidth={2}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 placeholder-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  )
}
