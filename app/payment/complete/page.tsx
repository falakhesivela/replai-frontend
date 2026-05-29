import PaymentCompleteView from './payment-complete-view'

export const metadata = {
  title: 'Payment complete | Replai',
  description: 'Payment confirmation for your order or booking',
}

export default async function PaymentCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>
}) {
  const q = await searchParams
  const reference = (q.reference ?? q.trxref ?? '').trim()
  return <PaymentCompleteView reference={reference} />
}
