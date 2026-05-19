import Link from 'next/link'
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { X } from 'lucide-react'
import { RetailerSearchBar } from '@/components/retailer/retailer-search-bar'

type Tab = 'suppliers' | 'products'

type Props = {
  q: string
  tab: Tab
  totalCount: number
  catsParam: string | null
  productSort?: string
  showCategoryFilters?: boolean
  categoryFilters?: ReactNode
  children: ReactNode
}

export async function RetailerSearchResultsChrome({
  q,
  tab,
  totalCount,
  catsParam,
  productSort,
  showCategoryFilters,
  categoryFilters,
  children,
}: Props) {
  const t = await getTranslations('SearchPage')

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10 sm:space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-primary/12 via-background to-background px-4 py-5 sm:px-6 sm:py-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-24 top-0 h-44 w-44 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t('search')}</p>
            <h1 className="mt-1 text-xl font-bold leading-tight text-foreground sm:text-2xl">
              {t('resultsFor', { q })}
            </h1>
            <p className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold tabular-nums text-primary">
              {t('resultsCount', { count: totalCount })}
            </p>
          </div>
          <Link
            href="/retailer/search"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 self-start rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
          >
            <X className="h-4 w-4" aria-hidden />
            {t('clear')}
          </Link>
        </div>
      </header>

      <div className="sticky top-0 z-20 -mx-1 px-1 pb-1 pt-0.5 sm:static sm:mx-0 sm:px-0 sm:pb-0">
        <RetailerSearchBar
          defaultQ={q}
          tab={tab}
          showTabs
          catsParam={catsParam}
          productsSort={productSort}
          variant="compact"
        />
      </div>

      {showCategoryFilters && categoryFilters ? (
        <div className="scroll-mt-24">{categoryFilters}</div>
      ) : null}

      {children}
    </div>
  )
}
