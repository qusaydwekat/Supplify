'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }
>(({ className, variant = 'primary', type = 'button', ...props }, ref) => {
  const base =
    'inline-flex min-h-10 items-center justify-center rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'

  const variants: Record<string, string> = {
    primary:
      'bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20',
    secondary:
      'border border-border bg-card text-foreground hover:bg-muted',
    ghost: 'text-foreground hover:bg-muted',
  }

  return <button ref={ref} type={type} className={cn(base, variants[variant], 'px-4 py-2', className)} {...props} />
})

Button.displayName = 'Button'
