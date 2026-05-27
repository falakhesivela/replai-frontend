import { LinkTabs } from '@/components/ui'

const TABS = [
  { href: '/portal/bookings', label: 'All Bookings' },
  { href: '/portal/my-bookings', label: 'My Bookings' },
]

export default function BookingsTabs() {
  return <LinkTabs items={TABS} className="mb-6" />
}
