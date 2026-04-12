import { PortalLoginForm } from './portal-login-form'

function safePortalNext(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string' || !v.startsWith('/portal') || v.startsWith('//')) {
    return undefined
  }
  return v
}

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string | string[]; reset?: string }>
}) {
  const q = await searchParams
  return (
    <PortalLoginForm
      accountError={q.error === 'no_account'}
      nextPath={safePortalNext(q.next)}
      passwordReset={q.reset === '1'}
    />
  )
}
