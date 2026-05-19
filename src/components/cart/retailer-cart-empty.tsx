'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Compass, ShoppingCart } from 'lucide-react'

export function RetailerCartEmpty() {
  const t = useTranslations('Cart')

  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-gradient-to-br from-primary/8 via-background to-background px-6 py-14 text-center sm:py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
        <ShoppingCart className="h-8 w-8" aria-hidden />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-foreground sm:text-xl">{t('emptyTitle')}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{t('emptySubtitle')}</p>
      <Link
        href="/retailer/browse"
        className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
      >
        <Compass className="h-4 w-4" aria-hidden />
        {t('browseSuppliers')}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  )
}
