import { redirect } from 'next/navigation'
import { getClientProfile, createClient } from '@/lib/supabase/server'
import SettingsForm from './_components/settings-form'

export default async function PortalSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/portal/login')

  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  return <SettingsForm email={user.email ?? ''} client={client} />
}
