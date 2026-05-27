'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, Save } from 'lucide-react'
import { saveTrialConfigAction, type TrialConfigState } from '../actions'
import { useToast } from '@/components/toast'
import type { TrialConfig } from '@/lib/api.server'

const CHANNELS: { key: string; label: string }[] = [
  { key: 'website', label: 'Website widget' },
  { key: 'whatsapp', label: 'WhatsApp' },
]

const ADDONS: { key: string; label: string }[] = [
  { key: 'bookings', label: 'Bookings' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'broadcasts', label: 'Broadcasts' },
]

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 transition-colors"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={2} />}
      {pending ? 'Saving…' : 'Save trial settings'}
    </button>
  )
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900'

const initialState: TrialConfigState = {}

export default function TrialConfigForm({ config }: { config: TrialConfig }) {
  const [state, action] = useActionState(saveTrialConfigAction, initialState)
  const { toast } = useToast()

  useEffect(() => {
    if (state.success) toast.success('Trial settings saved.')
    else if (state.error) toast.error(state.error)
  }, [state, toast])

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="duration_days" className="block text-sm font-medium text-gray-700 mb-1">
            Trial length (days)
          </label>
          <input
            id="duration_days"
            name="duration_days"
            type="number"
            min={1}
            required
            defaultValue={config.duration_days}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="included_conversations" className="block text-sm font-medium text-gray-700 mb-1">
            Included conversations
          </label>
          <input
            id="included_conversations"
            name="included_conversations"
            type="number"
            min={0}
            placeholder="Unlimited"
            defaultValue={config.included_conversations ?? ''}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400">Leave blank for unlimited.</p>
        </div>
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">Channels included</legend>
        <div className="flex gap-4">
          {CHANNELS.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="channels"
                value={c.key}
                defaultChecked={config.channels.includes(c.key)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-2">Add-ons included</legend>
        <div className="flex flex-wrap gap-4">
          {ADDONS.map((a) => (
            <label key={a.key} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="addons"
                value={a.key}
                defaultChecked={config.addons.includes(a.key)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={config.is_active}
          className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
        />
        Trial active (new signups start a free trial)
      </label>

      <div className="flex justify-end pt-1">
        <SubmitButton />
      </div>
    </form>
  )
}
