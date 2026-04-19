import { redirect } from 'next/navigation'
import { getEffectivePortalRole } from '@/lib/team-auth'
import ProductsView from './_components/products-view'

export default async function ProductsPage() {
  const role = await getEffectivePortalRole()
  if (!role || (role !== 'owner' && role !== 'manager')) {
    redirect('/portal/overview')
  }

  return <ProductsView role={role} />
}
