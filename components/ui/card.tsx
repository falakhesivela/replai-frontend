import { cn } from './cn'

type Padding = 'none' | 'sm' | 'md'
type Variant = 'default' | 'glass'

const PADDING: Record<Padding, string> = {
  none: '',
  sm: 'p-5',
  md: 'p-6',
}

const VARIANTS: Record<Variant, string> = {
  default: 'border-line bg-surface',
  /** Translucent surface for hero/emphasis cards over the canvas. */
  glass: 'border-line bg-surface/70 backdrop-blur-md',
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 'md' (p-6, default) for standalone cards; 'none' when the card wraps its
   *  own header/table sections that manage their own padding. */
  padding?: Padding
  variant?: Variant
}

export function Card({
  padding = 'md',
  variant = 'default',
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border shadow-card',
        VARIANTS[variant],
        PADDING[padding],
        className
      )}
      {...props}
    />
  )
}
