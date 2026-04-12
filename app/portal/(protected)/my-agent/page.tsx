import { redirect } from 'next/navigation'
import { getClientProfile } from '@/lib/supabase/server'
import AgentForm from './_components/agent-form'

export default async function MyAgentPage() {
  const client = await getClientProfile()

  if (!client) {
    redirect('/portal/login')
  }

  return (
    <AgentForm
      initialPrompt={client.system_prompt ?? ''}
      initialAgentName={client.agent_name ?? ''}
      initialAutoLanguage={client.agent_auto_language ?? true}
      initialUseEmoji={client.agent_use_emoji ?? false}
      initialSignOff={client.agent_sign_off ?? true}
      initialResponseStyle={client.agent_response_style ?? 'friendly'}
    />
  )
}
