import { cn } from './cn'

/** Card-wrapped table shell with horizontal scroll. */
export function TableShell({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-surface shadow-card',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  )
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-line bg-surface-2 text-left text-xs font-medium text-ink-3">
        {children}
      </tr>
    </thead>
  )
}

export function Th({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-3', className)} {...props} />
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>
}

export function Tr({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('transition-colors hover:bg-surface-2/60', className)}
      {...props}
    />
  )
}

export function Td({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 text-ink-2', className)} {...props} />
}
