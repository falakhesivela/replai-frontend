'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, Save } from 'lucide-react'
import { saveSystemPromptAction } from '../actions'
import { Toast, type ToastData } from './toast'
import { Card } from '@/components/ui'

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Save size={13} strokeWidth={2} />
      )}
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  )
}

export default function SystemPromptCard({
  clientId,
  initialPrompt,
}: {
  clientId: string
  initialPrompt: string
}) {
  const [state, action] = useActionState(saveSystemPromptAction, {})
  const [toast, setToast] = useState<ToastData | null>(null)

  useEffect(() => {
    if (state.success) {
      setToast({ message: 'Changes saved.', type: 'success' })
    } else if (state.error) {
      setToast({ message: state.error, type: 'error' })
    }
  }, [state])

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold text-gray-900">AI Configuration</h3>
      <p className="mb-5 text-xs text-gray-500">
        Define the personality and behaviour of the AI agent for this client.
      </p>

      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={clientId} />

        <div>
          <label
            htmlFor="system_prompt"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            System prompt
          </label>
          <textarea
            id="system_prompt"
            name="system_prompt"
            rows={10}
            defaultValue={initialPrompt}
            required
            className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        <div className="flex justify-end">
          <SaveButton />
        </div>
      </form>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </Card>
  )
}
