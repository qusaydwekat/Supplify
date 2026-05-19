'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { useCartContext } from '@/components/cart/cart-provider'
import { CartLine } from '@/components/cart/cart-item'
import { CartCheckoutSummary } from '@/components/cart/cart-checkout-summary'
import { createOrder } from '@/lib/actions/orders'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export function CartDrawer() {
  const t = useTranslations('Cart')
  const tErr = useTranslations('Errors')
  const router = useRouter()
  const { items, supplierId, supplierCurrency, isOpen, setOpen, clearCart } = useCartContext()
  const [notes, setNotes] = useState('')
  const [isCod, setIsCod] = useState(false)
  const [pending, startTransition] = useTransition()

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
      setOpen(false)
      if (res.orderId) router.push(`/retailer/orders/${res.orderId}`)
      router.refresh()
    })
  }

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!isOpen}
        onClick={() => setOpen(false)}
      />
      <aside
        className={cn(
          'fixed end-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-s border-border bg-background shadow-2xl transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={t('title')}
      >
        <div className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-4 backdrop-blur-sm sm:px-5">
          <h2 className="text-lg font-bold tracking-tight text-foreground">{t('title')}</h2>
          <button
            type="button"
            className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={() => setOpen(false)}
            aria-label={t('drawerClose')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-sm text-muted-foreground">{t('empty')}</p>
              <Link
                href="/retailer/browse"
                onClick={() => setOpen(false)}
                className="mt-4 text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                {t('browseSuppliers')}
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <CartLine key={item.variationId} item={item} compact />
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border bg-card/80 p-4 backdrop-blur-sm sm:p-5">
            <Link
              href="/retailer/cart"
              onClick={() => setOpen(false)}
              className="mb-3 block text-center text-xs font-semibold text-primary underline-offset-2 hover:underline"
            >
              {t('viewFullCart')}
            </Link>
            <CartCheckoutSummary
              compact
              notes={notes}
              onNotesChange={setNotes}
              isCod={isCod}
              onCodChange={setIsCod}
              subtotal={subtotal}
              supplierCurrency={supplierCurrency}
              pending={pending}
              onCheckout={checkout}
              className="border-0 bg-transparent p-0 shadow-none"
            />
          </div>
        )}
      </aside>
    </>
  )
}
