import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
}

/** Same value as `portal_user_role` but readable by the browser for client-side UI gates. */
const COOKIE_UI_ROLE = {
  httpOnly: false,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
}

/** Admin allowlist for /dashboard — comma-separated emails in ADMIN_EMAILS. */
function isAdminUser(user: User): boolean {
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const email = user.email?.toLowerCase()
  return Boolean(email && allowlist.includes(email))
}

function normalizeTeamRole(raw: unknown): 'manager' | 'agent' {
  const r = String(raw ?? 'agent').toLowerCase()
  return r === 'manager' ? 'manager' : 'agent'
}

function applyPortalAccess(
  request: NextRequest,
  response: NextResponse,
  user: User
) {
  const cachedUid = request.cookies.get('portal_auth_uid')?.value
  const cachedType = request.cookies.get('portal_user_type')?.value
  if (
    cachedUid === user.id &&
    (cachedType === 'owner' || cachedType === 'team_member')
  ) {
    return response
  }

  return null
}

const LEGACY_PAYSTACK_RETURN_PATHS = [
  '/portal/integrations/paystack',
  '/portal/settings/payments',
]

function isLegacyPaystackReturnPath(path: string): boolean {
  return LEGACY_PAYSTACK_RETURN_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  )
}

/** Copy query string to the public payment return page. */
function toPaymentCompleteUrl(request: NextRequest): URL {
  const dest = new URL('/payment/complete', request.url)
  request.nextUrl.searchParams.forEach((value, key) => {
    dest.searchParams.set(key, value)
  })
  return dest
}

/** Paystack return with ?reference= / ?trxref= (before auth check). */
function redirectLegacyPaystackCallback(request: NextRequest): NextResponse | null {
  if (!isLegacyPaystackReturnPath(request.nextUrl.pathname)) {
    return null
  }
  const reference =
    request.nextUrl.searchParams.get('reference') ??
    request.nextUrl.searchParams.get('trxref')
  if (!reference) {
    return null
  }
  return NextResponse.redirect(toPaymentCompleteUrl(request))
}

export async function proxy(request: NextRequest) {
  const { pathname: path } = request.nextUrl
  const isPortalRoute = path.startsWith('/portal')

  const paystackReturn = redirectLegacyPaystackCallback(request)
  if (paystackReturn) {
    return paystackReturn
  }

  if (
    path.startsWith('/portal/login') ||
    path.startsWith('/portal/forgot-password') ||
    path.startsWith('/portal/reset-password')
  ) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (isPortalRoute) {
      // Customers returning from Paystack often hit the old portal URL with no session.
      if (isLegacyPaystackReturnPath(path)) {
        return NextResponse.redirect(toPaymentCompleteUrl(request))
      }
      const loginUrl = new URL('/portal/login', request.url)
      loginUrl.searchParams.set('next', path)
      return NextResponse.redirect(loginUrl)
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
  }

  // The dashboard server-fetches with ADMIN_API_KEY, so an authenticated
  // session alone must never grant access — only allowlisted admins pass.
  if (path.startsWith('/dashboard') && !isAdminUser(user)) {
    return NextResponse.redirect(new URL('/portal/overview', request.url))
  }

  if (isPortalRoute) {
    const fast = applyPortalAccess(request, response, user)
    if (fast) return fast

    const { data: clientRow } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (clientRow) {
      response.cookies.set('portal_auth_uid', user.id, COOKIE_OPTS)
      response.cookies.set('portal_user_type', 'owner', COOKIE_OPTS)
      response.cookies.set('portal_user_role', 'owner', COOKIE_OPTS)
      response.cookies.set('portal_ui_role', 'owner', COOKIE_UI_ROLE)
      return response
    }

    const { data: memberRow } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (memberRow) {
      const role = normalizeTeamRole(memberRow.role)
      response.cookies.set('portal_auth_uid', user.id, COOKIE_OPTS)
      response.cookies.set('portal_user_type', 'team_member', COOKIE_OPTS)
      response.cookies.set('portal_user_role', role, COOKIE_OPTS)
      response.cookies.set('portal_ui_role', role, COOKIE_UI_ROLE)
      return response
    }

    return NextResponse.redirect(
      new URL('/portal/login?error=no_account', request.url)
    )
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/portal/:path*'],
}
