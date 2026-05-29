import { redirect } from 'next/navigation'

/** @deprecated Use /portal/integrations/paystack */
export default function LegacyPaymentsSettingsPage() {
  redirect('/portal/integrations/paystack')
}
