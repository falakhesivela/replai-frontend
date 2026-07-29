import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from './_components/dashboard-shell'
import { ToastProvider } from '@/components/toast'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Defense-in-depth alongside the proxy.ts gate: dashboard pages fetch with
  // ADMIN_API_KEY, so only allowlisted admins may render them.
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (!user.email || !allowlist.includes(user.email.toLowerCase())) {
    redirect('/portal/overview')
  }

  return (
    <ToastProvider>
      <DashboardShell email={user.email ?? ''}>
        {children}
      </DashboardShell>
    </ToastProvider>
  )
}
