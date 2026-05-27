import { redirect } from 'next/navigation'
import { getClientProfile } from '@/lib/supabase/server'
import PlaygroundView from './_components/playground-view'

export default async function PlaygroundPage() {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  return (
    <PlaygroundView
      agentName={client.agent_name ?? 'AI Agent'}
    />
  )
}
