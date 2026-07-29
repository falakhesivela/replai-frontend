import { cn } from './cn'

interface FieldProps {
  label: string
  htmlFor?: string
  /** Muted helper text under the control. */
  help?: string
  /** Error message — replaces help and colors the label. */
  error?: string | null
  required?: boolean
  className?: string
  children: React.ReactNode
}

/** Label + control + help/error, the one way to lay out a form row. */
export function Field({
  label,
  htmlFor,
  help,
  error,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <label
        htmlFor={htmlFor}
        className={cn(
          'block text-xs font-medium',
          error ? 'text-danger' : 'text-ink-2'
        )}
      >
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : help ? (
        <p className="text-xs text-ink-3">{help}</p>
      ) : null}
    </div>
  )
}
