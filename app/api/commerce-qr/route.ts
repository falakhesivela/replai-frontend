import QRCode from 'qrcode'
import { type NextRequest, NextResponse } from 'next/server'

function appOrigin(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    request.nextUrl.origin
  )
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('kind')
  const ref = request.nextUrl.searchParams.get('ref')?.trim().replace(/^#/, '').toLowerCase()

  if (!ref || !/^[0-9a-f]{4,8}$/.test(ref)) {
    return NextResponse.json({ detail: 'Invalid reference' }, { status: 400 })
  }
  if (kind !== 'order' && kind !== 'booking') {
    return NextResponse.json({ detail: 'Invalid kind' }, { status: 400 })
  }

  const origin = appOrigin(request)
  const path = kind === 'order' ? '/portal/ecommerce/orders' : '/portal/bookings'
  const lookupUrl = `${origin}${path}?ref=${encodeURIComponent(ref)}`

  const png = await QRCode.toBuffer(lookupUrl, {
    type: 'png',
    margin: 2,
    width: 320,
    errorCorrectionLevel: 'M',
  })

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
