'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArrowLeft, ShoppingBag, Store } from 'lucide-react'
import { useCartContext } from '@/components/cart/cart-provider'
import { CartLine } from '@/components/cart/cart-item'
import { CartCheckoutSummary } from '@/components/cart/cart-checkout-summary'
import { RetailerCartEmpty } from '@/components/cart/retailer-cart-empty'
import { createOrder } from '@/lib/actions/orders'

export default function RetailerCartPage() {
  const t = useTranslations('Cart')
  const tErr = useTranslations('Errors')
  const router = useRouter()
  const { items, supplierId, supplierLabel, supplierCurrency, clearCart } = useCartContext()
  const [notes, setNotes] = useState('')
  const [isCod, setIsCod] = useState(false)
  const [pending, startTransition] = useTransition()

  const itemCount = items.reduce((n, i) => n + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

  const checkout = () => {
    if (!supplierId || items.length === 0) return
    startTransition(async () => {
      const res = await createOrder(items, supplierId, notes || undefined, { isCod })
      if (res.error) {
        if (res.errorKey) toast.error(tErr(res.errorKey, res.errorParams ?? undefined))
        else toast.error(res.error)
        return
      }
      res.warnings.forEach((w) => toast.warning(w))
      if (res.creditWarning) {
        toast.warning(tErr(res.creditWarning.messageKey, res.creditWarning.params))
      }
      toast.success(t('success'))
      clearCart()
      setNotes('')
      if (res.orderId) router.push(`/retailer/orders/${res.orderId}`)
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 sm:space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-primary/12 via-background to-background px-5 py-6 sm:px-8 sm:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20 sm:h-14 sm:w-14">
              <ShoppingBag className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t('title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">{t('pageSubtitle')}</p>
              {items.length > 0 ? (
                <p className="mt-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold tabular-nums text-primary">
                  {t('itemCount', { count: itemCount })}
                </p>
              ) : null}
            </div>
          </div>

          {supplierId && supplierLabel && items.length > 0 ? (
            <div className="flex flex-col gap-2 sm:items-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm sm:text-sm">
                <Store className="h-3.5 w-3.5 text-primary" aria-hidden />
                {t('orderingFrom', { supplier: supplierLabel })}
              </span>
              <Link
                href={`/retailer/browse/${supplierId}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                {t('continueShopping')}
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      {items.length === 0 ? (
        <RetailerCartEmpty />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-start lg:gap-8">
          <section aria-labelledby="cart-items-heading">
            <h2 id="cart-items-heading" className="sr-only">
              {t('itemsHeading')}
            </h2>
            <ul className="space-y-4">
              {items.map((item) => (
                <CartLine key={item.variationId} item={item} />
              ))}
            </ul>
          </section>

          <aside className="lg:sticky lg:top-20">
            <CartCheckoutSummary
              notes={notes}
              onNotesChange={setNotes}
              isCod={isCod}
              onCodChange={setIsCod}
              subtotal={subtotal}
              supplierCurrency={supplierCurrency}
              pending={pending}
              onCheckout={checkout}
            />
          </aside>
        </div>
      )}
    </div>
  )
}
