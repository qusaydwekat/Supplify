'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Minus, Package, Plus, RotateCcw, ShoppingCart } from 'lucide-react'
import { getReorderCartPayloadForProduct } from '@/lib/actions/reorder'
import { useCartContext } from '@/components/cart/cart-provider'
import { formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type StorefrontVariation = {
  id: string
  name: string
  price: number
  stock_quantity: number
  min_order_quantity: number
}

type Props = {
  supplierId: string
  supplierLabel: string
  supplierCurrency: string
  product: {
    id: string
    name: string
    description: string | null
    image_url: string | null
    has_variations: boolean
    category?: string | null
  }
  variations: StorefrontVariation[]
  hasOrderedBefore?: boolean
  showReorder?: boolean
}

export function ProductCard({
  supplierId,
  supplierLabel,
  supplierCurrency,
  product,
  variations,
  hasOrderedBefore,
  showReorder = false,
}: Props) {
  const router = useRouter()
  const t = useTranslations('ProductCard')
  const tToast = useTranslations('Toasts')
  const { addItem, replaceCartWithItems, setOpen } = useCartContext()
  const sorted = useMemo(() => [...variations].sort((a, b) => a.name.localeCompare(b.name)), [variations])

  const firstId = sorted[0]?.id ?? ''
  const [variationId, setVariationId] = useState(firstId)
  const [qty, setQty] = useState(1)
  const [reorderLoading, setReorderLoading] = useState(false)

  const selected = sorted.find((v) => v.id === variationId) ?? sorted[0]
  const outOfStock = selected ? Number(selected.stock_quantity) <= 0 : true
  const lowStock =
    selected &&
    Number(selected.stock_quantity) > 0 &&
    Number(selected.stock_quantity) < Number(selected.min_order_quantity) * 3

  const displayPrice = selected
    ? formatCurrency(Number(selected.price), supplierCurrency)
    : formatCurrency(0, supplierCurrency)

  const onAdd = () => {
    if (!selected || outOfStock) return
    if (qty < selected.min_order_quantity) {
      toast.error(tToast('minOrderQty', { qty: selected.min_order_quantity }))
      return
    }
    addItem(
      {
        variationId: selected.id,
        productId: product.id,
        supplierId,
        supplierCurrency,
        productName: product.name,
        variationName: product.has_variations ? selected.name : null,
        quantity: qty,
        unitPrice: Number(selected.price),
      },
      supplierLabel,
      supplierCurrency,
    )
    toast.success(tToast('addedToCart'))
    setOpen(true)
  }

  const onReorderProduct = async () => {
    setReorderLoading(true)
    const r = await getReorderCartPayloadForProduct(supplierId, product.id)
    setReorderLoading(false)
    if (r.error) {
      toast.error(r.error)
      return
    }
    if (!r.items?.length || !r.supplierId || !r.supplierLabel) {
      toast.error(tToast('nothingToAdd'))
      return
    }
    replaceCartWithItems(r.items, r.supplierId, r.supplierLabel, r.supplierCurrency ?? 'USD')
    if (r.warnings.length) r.warnings.forEach((w) => toast.message(w))
    toast.success(tToast('cartUpdatedFromLastOrder'))
    setOpen(true)
    router.push('/retailer/cart')
  }

  const bumpQty = (delta: number) => {
    const min = selected?.min_order_quantity ?? 1
    setQty((prev) => Math.max(min, prev + delta))
  }

  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <Package className="h-8 w-8 text-muted-foreground/50" aria-hidden />
        <p className="mt-3 text-sm text-muted-foreground">{t('noVariations')}</p>
      </div>
    )
  }

  return (
    <article
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card',
        'shadow-sm shadow-slate-900/5 transition duration-200',
        'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
      )}
    >
      {/* Image */}
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-gradient-to-br from-primary/8 via-muted to-muted/50 sm:aspect-[4/3]">
        {product.image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url}
              alt=""
              className="h-full w-full object-cover transition duration-500 hover:scale-105"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/25 via-transparent to-transparent"
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Package className="h-10 w-10 opacity-35" aria-hidden />
            <span className="text-xs font-medium">{t('noImage')}</span>
          </div>
        )}

        {product.category ? (
          <span className="absolute start-2.5 top-2.5 max-w-[55%] truncate rounded-lg border border-border/50 bg-background/92 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground shadow-sm backdrop-blur-sm">
            {product.category}
          </span>
        ) : null}

        {!outOfStock ? (
          <span className="absolute end-2.5 top-2.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-md ring-2 ring-background/50">
            {displayPrice}
          </span>
        ) : (
          <span className="absolute end-2.5 top-2.5 rounded-lg bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground shadow-sm ring-2 ring-background/50">
            {t('outOfStock')}
          </span>
        )}

        <div className="absolute start-2.5 bottom-2.5 flex flex-wrap gap-1.5">
          {hasOrderedBefore ? (
            <span className="rounded-md bg-background/92 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary shadow-sm backdrop-blur-sm">
              {t('orderedBefore')}
            </span>
          ) : null}
          {lowStock && !outOfStock ? (
            <span className="rounded-md bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              {t('lowStock')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
          {product.name}
        </h3>

        {product.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>
        ) : null}

        {product.has_variations && sorted.length > 1 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('variation')}
            </p>
            {sorted.length <= 4 ? (
              <div className="flex flex-wrap gap-1.5">
                {sorted.map((v) => {
                  const disabled = Number(v.stock_quantity) <= 0
                  const active = v.id === variationId
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => setVariationId(v.id)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium transition',
                        active
                          ? 'border-primary bg-primary/10 text-primary shadow-sm'
                          : 'border-border bg-muted/40 text-foreground hover:border-primary/30',
                        disabled && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <span className="block truncate">{v.name}</span>
                      <span className="mt-0.5 block tabular-nums text-[10px] opacity-80">
                        {formatCurrency(Number(v.price), supplierCurrency)}
                        {disabled ? ` · ${t('outOfStock')}` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <select
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm shadow-inner outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
                value={variationId}
                onChange={(e) => setVariationId(e.target.value)}
              >
                {sorted.map((v) => (
                  <option key={v.id} value={v.id} disabled={Number(v.stock_quantity) <= 0}>
                    {v.name} — {formatCurrency(Number(v.price), supplierCurrency)}
                    {Number(v.stock_quantity) <= 0 ? ` (${t('outOfStock')})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xl font-bold tabular-nums text-foreground">{displayPrice}</p>
        )}

        {!outOfStock ? (
          <div className="mt-4 space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('qty')}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-10 w-10 shrink-0 rounded-xl p-0"
                aria-label={t('decreaseQty')}
                onClick={() => bumpQty(-1)}
                disabled={qty <= (selected.min_order_quantity ?? 1)}
              >
                <Minus className="h-4 w-4" aria-hidden />
              </Button>
              <input
                type="number"
                min={selected.min_order_quantity}
                aria-label={t('qty')}
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-center text-sm font-semibold tabular-nums shadow-inner outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
                value={qty}
                onChange={(e) => {
                  const n = Math.max(selected.min_order_quantity, Number(e.target.value) || 1)
                  setQty(n)
                }}
              />
              <Button
                type="button"
                variant="secondary"
                className="h-10 w-10 shrink-0 rounded-xl p-0"
                aria-label={t('increaseQty')}
                onClick={() => bumpQty(1)}
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('min')} {selected.min_order_quantity}
            </p>
          </div>
        ) : null}

        <div className="mt-auto space-y-2 pt-4">
          {!outOfStock ? (
            <Button
              type="button"
              className="h-11 w-full gap-2 rounded-xl text-sm font-semibold shadow-sm"
              onClick={onAdd}
            >
              <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden />
              {t('addToCart')}
            </Button>
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-3 text-center text-sm font-medium text-muted-foreground">
              {t('outOfStock')}
            </p>
          )}

          {showReorder ? (
            <Button
              type="button"
              variant="secondary"
              className="h-10 w-full gap-2 rounded-xl text-sm font-semibold"
              disabled={reorderLoading}
              onClick={() => onReorderProduct()}
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
              {reorderLoading
                ? t('loading')
                : outOfStock
                  ? t('reorderFromDelivery')
                  : t('reorder')}
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
