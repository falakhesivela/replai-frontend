import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Mail } from 'lucide-react'
import ChangePasswordForm from './_components/change-password-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-base font-semibold text-gray-900">Settings</h2>

      {/* Account */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Account</h3>
        <p className="mb-5 text-xs text-gray-500">Your login details.</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <div className="flex items-center gap-2.5 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <Mail size={14} className="shrink-0 text-gray-400" strokeWidth={1.75} />
            <span className="text-sm text-gray-600 select-all">{user.email}</span>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            Email address cannot be changed from this dashboard.
          </p>
        </div>
      </section>

      {/* Password */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Change password</h3>
        <p className="mb-5 text-xs text-gray-500">
          Choose a strong password at least 8 characters long.
        </p>
        <ChangePasswordForm />
      </section>
    </div>
  )
}
