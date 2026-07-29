'use client'

import { Dialog } from './dialog'
import { Button } from './button'

/** Styled replacement for window.confirm on destructive actions. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open onClose={onCancel} title={title} description={description} width="max-w-sm">
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
