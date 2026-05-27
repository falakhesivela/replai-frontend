import { redirect } from 'next/navigation'
import { getClientProfile, createClient } from '@/lib/supabase/server'
import { isFeatureUnlocked } from '@/lib/entitlements.server'
import FeatureLocked from '../_components/feature-locked'
import { getMyWidgetConfig } from '@/lib/api'
import type { WidgetConfig } from '@/lib/types'
import WidgetSettingsForm from './_components/widget-settings-form'

const DEFAULT_CONFIG: Omit<WidgetConfig, 'widget_id'> = {
  welcome_message: 'Hi there! How can I help you today?',
  brand_color: '#6366f1',
  position: 'bottom-right',
  collect_lead: false,
  agent_name: 'Support',
  agent_tagline: 'Typically replies in seconds',
  agent_avatar_url: null,
}

export default async function ChatbotWidgetPage() {
  const client = await getClientProfile()
  if (!client) redirect('/portal/login')

  if (!(await isFeatureUnlocked('website_widget'))) {
    return <FeatureLocked feature="website_widget" />
  }

  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''

  let config: WidgetConfig | null = null
  if (token) {
    try {
      config = await getMyWidgetConfig(token)
    } catch {
      // Widget not configured yet — use defaults
    }
  }

  return (
    <WidgetSettingsForm
      initialConfig={config ?? { widget_id: '', ...DEFAULT_CONFIG }}
    />
  )
}
