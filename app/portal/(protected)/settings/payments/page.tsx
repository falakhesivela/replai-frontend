import { redirect } from 'next/navigation'

/**
 * @deprecated Use /portal/integrations/paystack for the settings UI.
 *
 * Do NOT delete this route: it is a legacy Paystack return URL. proxy.ts lists
 * it in LEGACY_PAYSTACK_RETURN_PATHS and redirects customers arriving here with
 * ?reference=/?trxref= to /payment/complete — this page only catches the
 * no-reference case for signed-in users.
 */
export default function LegacyPaymentsSettingsPage() {
  redirect('/portal/integrations/paystack')
}
