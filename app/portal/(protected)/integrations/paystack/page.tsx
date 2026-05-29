import { redirect } from 'next/navigation'
import { getClientProfile, createClient } from '@/lib/supabase/server'
import { getEffectivePortalRole } from '@/lib/team-auth'
import PaystackIntegrationView from './_components/paystack-integration-view'

export default async function PaystackIntegrationPage() {
  const role = await getEffectivePortalRole()
  if (role !== 'owner') {
    redirect('/portal/overview')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/portal/login')

  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  return (
    <PaystackIntegrationView
      ownerEmail={user.email ?? ''}
      businessName={client.business_name}
    />
  )
}
