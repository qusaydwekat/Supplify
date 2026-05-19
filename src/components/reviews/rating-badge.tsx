import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  avgRating: number | null
  reviewCount: number
  size?: 'sm' | 'md'
  className?: string
}

export function RatingBadge({ avgRating, reviewCount, size = 'sm', className }: Props) {
  if (!avgRating || reviewCount === 0) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-muted-foreground',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className,
      )}
    >
      <Star
        className={cn(
          'fill-amber-400 text-amber-400',
          size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
        )}
      />
      <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
      <span>({reviewCount})</span>
    </span>
  )
}
