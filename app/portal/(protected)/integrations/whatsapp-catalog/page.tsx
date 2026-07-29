import { redirect } from 'next/navigation'
import { getClientProfile } from '@/lib/supabase/server'
import { isFeatureUnlocked } from '@/lib/entitlements.server'
import FeatureLocked from '../../_components/feature-locked'
import WhatsAppCatalogView from './_components/whatsapp-catalog-view'

export default async function WhatsAppCatalogIntegrationPage() {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  if (!(await isFeatureUnlocked('shopping'))) {
    return <FeatureLocked feature="shopping" />
  }

  return <WhatsAppCatalogView />
}
