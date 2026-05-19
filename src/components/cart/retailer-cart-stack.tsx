'use client'

import { ShoppingCart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCartContext } from '@/components/cart/cart-provider'
import { CartDrawer } from '@/components/cart/cart-drawer'
import { Button } from '@/components/ui/button'

export function RetailerCartStack() {
  const t = useTranslations('Cart')
  const tCommon = useTranslations('Common')
  const { items, setOpen, switchDialog, confirmSwitchSupplier, cancelSwitchSupplier } = useCartContext()
  const count = items.reduce((n, i) => n + i.quantity, 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 end-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 active:scale-95 md:bottom-8 md:end-8"
        aria-label={t('openCartAria')}
      >
        <ShoppingCart className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      <CartDrawer />

      {switchDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">{t('switchTitle')}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('switchPrompt', {
                from: switchDialog.supplierLabel,
                to: switchDialog.otherSupplierLabel,
              })}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={cancelSwitchSupplier}>
                {tCommon('cancel')}
              </Button>
              <Button type="button" onClick={confirmSwitchSupplier}>
                {t('clearAndContinue')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
