'use client'

import type { CartItem } from '@/types/cart'
import { useTranslations } from 'next-intl'
import { Minus, Package, Plus, Trash2 } from 'lucide-react'
import { useCartContext } from '@/components/cart/cart-provider'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type Props = {
  item: CartItem
  /** Slightly tighter padding in the slide-over drawer */
  compact?: boolean
}

export function CartLine({ item, compact = false }: Props) {
  const t = useTranslations('Cart')
  const { updateQuantity, removeItem, supplierCurrency } = useCartContext()
  const lineTotal = item.unitPrice * item.quantity
  const initial = item.productName.trim().charAt(0).toUpperCase() || '?'

  const bumpQty = (delta: number) => {
    const next = Math.max(1, item.quantity + delta)
    updateQuantity(item.variationId, next)
  }

  return (
    <li
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-primary/25 hover:shadow-md',
        compact ? 'p-3' : 'p-4 sm:p-5',
      )}
    >
      <button
        type="button"
        onClick={() => removeItem(item.variationId)}
        className="absolute end-3 top-3 rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        aria-label={t('remove')}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>

      <div className="flex gap-3 pe-10 sm:gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-lg font-bold text-primary ring-1 ring-primary/15 sm:h-16 sm:w-16">
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 pe-2 text-sm font-semibold leading-snug text-foreground sm:text-base">
            {item.productName}
          </p>
          {item.variationName ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
              <Package className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              <span className="truncate">{item.variationName}</span>
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCurrency(item.unitPrice, supplierCurrency)} {t('unitEach')}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('qtyLabel')}
          </span>
          <Button
            type="button"
            variant="secondary"
            className="h-9 w-9 shrink-0 rounded-lg p-0"
            aria-label={t('decreaseQty')}
            disabled={item.quantity <= 1}
            onClick={() => bumpQty(-1)}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </Button>
          <input
            type="number"
            min={1}
            aria-label={t('qtyLabel')}
            className="h-9 w-14 rounded-lg border border-border bg-background text-center text-sm font-semibold tabular-nums shadow-inner outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            value={item.quantity}
            onChange={(e) => updateQuantity(item.variationId, Math.max(1, Number(e.target.value) || 1))}
          />
          <Button
            type="button"
            variant="secondary"
            className="h-9 w-9 shrink-0 rounded-lg p-0"
            aria-label={t('increaseQty')}
            onClick={() => bumpQty(1)}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="text-end">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('lineTotal')}
          </p>
          <p className="text-base font-bold tabular-nums text-foreground sm:text-lg">
            {formatCurrency(lineTotal, supplierCurrency)}
          </p>
        </div>
      </div>
    </li>
  )
}
