'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const SORTS = [
  { value: 'recommended', key: 'sortRecommended' },
  { value: 'price_low', key: 'sortPriceLow' },
  { value: 'price_high', key: 'sortPriceHigh' },
  { value: 'name', key: 'sortName' },
] as const

type Props = {
  query: string
  activeSort: string
  catsParam?: string | null
}

export function RetailerSearchProductSort({ query, activeSort, catsParam }: Props) {
  const t = useTranslations('SearchPage')
  const q = encodeURIComponent(query)
  const cat =
    catsParam && catsParam.trim() ? `&cats=${encodeURIComponent(catsParam.trim())}` : ''

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('sortLabel')}
      </p>
      <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        {SORTS.map((s) => {
          const active = activeSort === s.value
          const sortQs = s.value === 'recommended' ? '' : `&sort=${s.value}`
          const href = `/retailer/search?q=${q}&tab=products${sortQs}${cat}`
          return (
            <Link
              key={s.value}
              href={href}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition sm:text-sm',
                active
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground',
              )}
            >
              {t(s.key)}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
