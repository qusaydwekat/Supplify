'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { PRODUCT_HUB_TABS, type ProductHubTab } from '@/lib/products/product-hub-tabs'
import { cn } from '@/lib/utils'

type Props = {
  productId: string
  activeTab: ProductHubTab
}

export function ProductHubNav({ productId, activeTab }: Props) {
  const t = useTranslations('ProductHub')

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
      {PRODUCT_HUB_TABS.map((tab) => {
        const href = tab === 'overview' ? `/supplier/products/${productId}` : `/supplier/products/${productId}?tab=${tab}`
        const active = activeTab === tab
        return (
          <Link
            key={tab}
            href={href}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
            )}
          >
            {t(`tab_${tab}`)}
          </Link>
        )
      })}
    </nav>
  )
}
