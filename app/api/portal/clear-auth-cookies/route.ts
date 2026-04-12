import { NextResponse } from 'next/server'

const COOKIE_NAMES = [
  'portal_auth_uid',
  'portal_user_type',
  'portal_user_role',
  'portal_ui_role',
] as const

export async function POST() {
  const res = NextResponse.json({ ok: true })
  for (const name of COOKIE_NAMES) {
    res.cookies.set(name, '', { path: '/', maxAge: 0 })
  }
  return res
}
