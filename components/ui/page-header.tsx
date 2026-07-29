import { cn } from './cn'

interface PageHeaderProps {
  title: string
  description?: string
  /** Right-aligned actions (buttons, links). */
  actions?: React.ReactNode
  className?: string
}

/** Canonical page title block. One size everywhere (text-2xl, tight tracking)
 *  — replaces the text-base/lg/xl/2xl drift across the app. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-ink-2">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
