import { notFound } from 'next/navigation'
import { getPublicWidgetConfig } from '@/lib/api'
import type { WidgetConfig } from '@/lib/types'
import WidgetChat from './_components/widget-chat'

interface Props {
  params: Promise<{ widgetId: string }>
}

export default async function WidgetPage({ params }: Props) {
  const { widgetId } = await params

  let config: WidgetConfig
  try {
    config = await getPublicWidgetConfig(widgetId)
  } catch {
    notFound()
  }

  return <WidgetChat widgetId={widgetId} config={config} />
}
