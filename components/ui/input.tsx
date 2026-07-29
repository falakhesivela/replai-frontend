import { cn } from './cn'

export const inputClasses =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-3 transition-colors focus:outline-none focus:ring-2 ' +
  'focus:ring-accent/40 focus:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed'

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClasses, className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(inputClasses, 'resize-none', className)} {...props} />
  )
}

/** Styled native select — custom listbox is a later nice-to-have. */
export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClasses, 'appearance-none pr-8', className)} {...props} />
  )
}
