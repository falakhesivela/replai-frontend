import { cn } from './cn'

type Padding = 'none' | 'sm' | 'md'

const PADDING: Record<Padding, string> = {
  none: '',
  sm: 'p-5',
  md: 'p-6',
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 'md' (p-6, default) for standalone cards; 'none' when the card wraps its
   *  own header/table sections that manage their own padding. */
  padding?: Padding
}

export function Card({ padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white',
        PADDING[padding],
        className
      )}
      {...props}
    />
  )
}
