import { isFeatureUnlocked } from '@/lib/entitlements.server'
import FeatureLocked from '../_components/feature-locked'
import BookingsTabs from '../bookings/_components/bookings-tabs'
import MyBookingsView from './_components/my-bookings-view'

export default async function MyBookingsPage() {
  if (!(await isFeatureUnlocked('bookings'))) {
    return <FeatureLocked feature="bookings" />
  }

  return (
    <>
      <BookingsTabs />
      <MyBookingsView />
    </>
  )
}
