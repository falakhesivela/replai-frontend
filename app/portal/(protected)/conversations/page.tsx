import { redirect } from 'next/navigation'
import { getClientProfile } from '@/lib/supabase/server'
import ConversationsView from './_components/conversations-view'

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>
}) {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  const q = await searchParams
  const phone = typeof q.phone === 'string' ? q.phone : null

  return <ConversationsView clientId={client.id} initialPhone={phone} />
}
