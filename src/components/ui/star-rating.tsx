'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
  className?: string
}

const sizes = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

export function StarRating({ value, onChange, size = 'md', readonly = false, className }: Props) {
  const [hovered, setHovered] = useState(0)
  const display = hovered || value

  return (
    <span
      className={cn('inline-flex gap-0.5', className)}
      onMouseLeave={() => !readonly && setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= display
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            tabIndex={readonly ? -1 : 0}
            className={cn(
              'transition-colors',
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110',
            )}
            onMouseEnter={() => !readonly && setHovered(star)}
            onClick={() => onChange?.(star)}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <Star
              className={cn(
                sizes[size],
                filled
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-slate-300',
              )}
            />
          </button>
        )
      })}
    </span>
  )
}
