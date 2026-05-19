'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RetailerSearchProductSort } from '@/components/retailer/retailer-search-product-sort'

type Tab = 'suppliers' | 'products'

type Props = {
  defaultQ: string
  tab: Tab
  showTabs: boolean
  productsSort?: string
  catsParam?: string | null
  variant?: 'default' | 'hero' | 'compact'
}

export function RetailerSearchBar({
  defaultQ,
  tab,
  showTabs,
  productsSort,
  catsParam,
  variant = 'default',
}: Props) {
  const t = useTranslations('SearchPage')

  const qEncoded = defaultQ.trim() ? encodeURIComponent(defaultQ.trim()) : ''
  const catSuffix =
    catsParam && catsParam.trim() ? `&cats=${encodeURIComponent(catsParam.trim())}` : ''
  const catHidden = catsParam?.trim()

  const isHero = variant === 'hero'
  const isCompact = variant === 'compact'

  return (
    <form
      method="get"
      action="/retailer/search"
      className={cn(
        'overflow-hidden shadow-sm',
        isHero
          ? 'rounded-2xl border border-border/70 bg-card/90 p-3 shadow-lg backdrop-blur-md sm:p-4'
          : isCompact
            ? 'rounded-2xl border border-border/80 bg-card/95 p-3 backdrop-blur-md supports-[backdrop-filter]:bg-card/85'
            : 'rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-4 sm:p-5',
      )}
    >
      <input type="hidden" name="tab" value={tab} />
      {catHidden ? <input type="hidden" name="cats" value={catHidden} /> : null}
      {tab === 'products' && productsSort && productsSort !== 'recommended' ? (
        <input type="hidden" name="sort" value={productsSort} />
      ) : null}

      {showTabs && qEncoded ? (
        <div
          className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1"
          role="tablist"
          aria-label={t('tabsAria')}
        >
          <TabLink
            href={`/retailer/search?q=${qEncoded}&tab=suppliers${catSuffix}`}
            active={tab === 'suppliers'}
            label={t('tabSuppliers')}
          />
          <TabLink
            href={`/retailer/search?q=${qEncoded}&tab=products${catSuffix}${
              productsSort && productsSort !== 'recommended' ? `&sort=${productsSort}` : ''
            }`}
            active={tab === 'products'}
            label={t('tabProducts')}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <label htmlFor="retailer-search-q" className="sr-only">
            {t('search')}
          </label>
          <input
            id="retailer-search-q"
            name="q"
            defaultValue={defaultQ}
            placeholder={t('searchPlaceholder')}
            autoComplete="off"
            enterKeyHint="search"
            autoFocus={!defaultQ.trim()}
            className={cn(
              'w-full rounded-xl border border-border bg-background py-2.5 ps-11 pe-4 text-base shadow-inner outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/25 sm:text-sm',
              isHero ? 'h-14' : 'h-12',
            )}
          />
        </div>
        <button
          type="submit"
          className={cn(
            'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]',
            isHero ? 'h-14 px-6 text-base sm:min-w-[8.5rem]' : 'h-12 px-5 text-sm sm:min-w-[7rem]',
          )}
        >
          <Search className="h-4 w-4 sm:hidden" aria-hidden />
          <span>{t('go')}</span>
        </button>
      </div>

      {tab === 'products' && productsSort != null && qEncoded ? (
        <div className="mt-3 border-t border-border/60 pt-3">
          <RetailerSearchProductSort query={defaultQ.trim()} activeSort={productsSort} catsParam={catsParam} />
        </div>
      ) : null}
    </form>
  )
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        'inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-semibold transition',
        active
          ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  )
}
