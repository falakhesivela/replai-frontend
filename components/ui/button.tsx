import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all ' +
  'disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 ' +
  'focus-visible:ring-offset-canvas active:scale-[0.98]'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-sm shadow-accent/25 hover:bg-accent-hover hover:shadow-md hover:shadow-accent/25',
  secondary:
    'border border-line bg-surface text-ink-2 shadow-xs hover:border-line-strong hover:bg-surface-2 hover:text-ink',
  ghost: 'text-ink-3 hover:bg-surface-2 hover:text-ink',
  danger:
    'bg-danger text-on-solid shadow-sm shadow-danger/25 hover:opacity-90 hover:shadow-md hover:shadow-danger/25',
  outline:
    'border border-accent/40 text-accent-text hover:border-accent hover:bg-accent-soft',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
  icon: 'h-8 w-8 p-0',
}

/** Class string for the button look. Use on `<Link>`/`<a>` styled as buttons:
 *  `<Link className={buttonClasses({ variant: 'secondary' })}>` */
export function buttonClasses(opts?: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}): string {
  const { variant = 'primary', size = 'md', className } = opts ?? {}
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  )
}
