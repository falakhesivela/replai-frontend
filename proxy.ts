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

export async function proxy(request: NextRequest) {
  const { pathname: path } = request.nextUrl
  const isPortalRoute = path.startsWith('/portal')

  if (
    path.startsWith('/portal/login') ||
    path.startsWith('/portal/forgot-password') ||
    path.startsWith('/portal/reset-password')
  ) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

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
          response = NextResponse.next({
            request: { headers: request.headers },
          })
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
      const loginUrl = new URL('/portal/login', request.url)
      loginUrl.searchParams.set('next', path)
      return NextResponse.redirect(loginUrl)
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
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
