'use client'

import QRCode from 'react-qr-code'
import {
  commercePortalLookupUrl,
  formatCommerceReference,
  type CommerceKind,
} from '@/lib/commerce-search'

export function CommerceConfirmationReference({
  id,
  kind,
  arrivalHint,
}: {
  id: string
  kind: CommerceKind
  arrivalHint: string
}) {
  if (!id) return null

  const lookupUrl = commercePortalLookupUrl(kind, id)

  return (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-white px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
        Your reference
      </p>
      <p className="font-mono text-lg font-bold tracking-wider text-gray-900">
        {formatCommerceReference(id)}
      </p>
      <div className="mt-3 flex justify-center rounded-lg bg-white p-2">
        <QRCode
          value={lookupUrl}
          size={128}
          level="M"
          bgColor="#ffffff"
          fgColor="#111827"
          aria-label={`QR code for ${formatCommerceReference(id)}`}
        />
      </div>
      <p className="mt-2 text-center text-xs text-gray-500">{arrivalHint}</p>
    </div>
  )
}
