'use client'

import { useTranslations } from 'next-intl'
import { CreditCard, Loader2, MessageSquare, Truck } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type Props = {
  notes: string
  onNotesChange: (value: string) => void
  isCod: boolean
  onCodChange: (value: boolean) => void
  subtotal: number
  supplierCurrency: string
  pending: boolean
  onCheckout: () => void
  className?: string
  compact?: boolean
}

export function CartCheckoutSummary({
  notes,
  onNotesChange,
  isCod,
  onCodChange,
  subtotal,
  supplierCurrency,
  pending,
  onCheckout,
  className,
  compact = false,
}: Props) {
  const t = useTranslations('Cart')

  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card shadow-sm',
        compact ? 'space-y-3 p-4' : 'space-y-4 p-5 sm:p-6',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/80 pb-3">
        <CreditCard className="h-5 w-5 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">{t('checkoutSummary')}</h2>
      </div>

      <div className="space-y-2">
        <label
          htmlFor={compact ? 'cart-notes-drawer' : 'cart-notes-page'}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          {t('notesLabel')}
        </label>
        <textarea
          id={compact ? 'cart-notes-drawer' : 'cart-notes-page'}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-inner outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/25"
          rows={compact ? 2 : 3}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={t('notesPlaceholder')}
        />
      </div>

      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-xl border transition',
          isCod
            ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
            : 'border-border bg-muted/30 hover:border-primary/25',
          compact ? 'p-3' : 'p-4',
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
          checked={isCod}
          onChange={(e) => onCodChange(e.target.checked)}
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Truck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {t('codTitle')}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{t('codHint')}</span>
        </span>
      </label>

      <div className="rounded-xl bg-muted/50 px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{t('subtotal')}</span>
          <span className="text-lg font-bold tabular-nums text-foreground">
            {formatCurrency(subtotal, supplierCurrency)}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{t('subtotalHint')}</p>
      </div>

      <Button
        type="button"
        className={cn('h-12 w-full gap-2 rounded-xl text-base font-semibold shadow-sm', compact && 'h-11 text-sm')}
        disabled={pending}
        onClick={onCheckout}
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            {t('placing')}
          </>
        ) : (
          t('placeOrder')
        )}
      </Button>
    </div>
  )
}
