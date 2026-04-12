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

  return (
    <ToastProvider>
      <DashboardShell email={user.email ?? ''}>
        {children}
      </DashboardShell>
    </ToastProvider>
  )
}
