import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import {
  MARKETPLACE_CATEGORY_SLUGS,
  UNCATEGORIZED_FILTER,
  parseCatsFromSearchParams as parseSelectedCatsFromParams,
  type MarketplaceCategorySlug,
} from '@/lib/supplier-marketplace-categories'

export { parseSelectedCatsFromParams }

type Mode = 'browse' | 'search'

type ExtraParams = Record<string, string | undefined>

function buildHref(pathname: string, base: ExtraParams, nextCats: string[]): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(base)) {
    if (v != null && v !== '') p.set(k, v)
  }
  if (nextCats.length) p.set('cats', [...nextCats].sort((a, b) => a.localeCompare(b)).join(','))
  const qs = p.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

type Props = {
  mode: Mode
  selectedCats: string[]
  /** Only for search mode */
  searchQuery?: string
  /** Browse: text search */
  browseQ?: string
  browseCity?: string
  browseSort?: string
  /** Search: product sort when switching away — unused here */
  className?: string
}

export async function MarketplaceCategoryFilterChips({
  mode,
  selectedCats,
  searchQuery,
  browseQ,
  browseCity,
  browseSort,
  className,
}: Props) {
  const t = await getTranslations('BrowsePage')
  const tCat = await getTranslations('MarketplaceCategories')

  const base: ExtraParams =
    mode === 'search'
      ? {
          q: searchQuery?.trim() || undefined,
          tab: 'suppliers',
        }
      : {
          q: browseQ?.trim() || undefined,
          city: browseCity?.trim() || undefined,
          sort: browseSort && browseSort !== 'recommended' ? browseSort : undefined,
        }

  const pathname = mode === 'search' ? '/retailer/search' : '/retailer/browse'

  const slugifyHref = (slug: string) => {
    const sel = selectedCats.includes(slug)
    const next = sel ? selectedCats.filter((c) => c !== slug) : [...selectedCats, slug]
    return buildHref(pathname, base, next)
  }

  const clearFiltersHref = buildHref(pathname, base, [])

  const allSelected = selectedCats.length === 0

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-gradient-to-br from-primary/[0.07] via-card to-card p-4 shadow-sm sm:p-5',
        className,
      )}
      aria-labelledby="marketplace-cat-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="marketplace-cat-heading" className="text-sm font-semibold tracking-tight text-foreground">
            {t('categoriesTitle')}
          </h2>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground sm:text-sm">{t('categoriesHint')}</p>
        </div>
        {!allSelected ? (
          <Link
            href={clearFiltersHref}
            className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline sm:text-sm"
          >
            {t('categoriesClear')}
          </Link>
        ) : null}
      </div>
      <div className="-ms-1 mt-3 flex flex-wrap gap-2 overflow-x-auto pb-1 ps-1">
        <Link
          href={buildHref(pathname, base, [])}
          className={cn(
            'inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm',
            allSelected
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
          )}
        >
          {t('categoriesAll')}
        </Link>
        {(MARKETPLACE_CATEGORY_SLUGS as readonly MarketplaceCategorySlug[]).map((slug) => {
          const sel = selectedCats.includes(slug)
          return (
            <Link
              key={slug}
              href={slugifyHref(slug)}
              scroll={false}
              className={cn(
                'inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm',
                sel
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-card text-foreground/90 hover:border-primary/35',
              )}
            >
              {tCat(slug)}
            </Link>
          )
        })}
        {(() => {
          const slug = UNCATEGORIZED_FILTER
          const sel = selectedCats.includes(slug)
          return (
            <Link
              key={slug}
              href={slugifyHref(slug)}
              scroll={false}
              className={cn(
                'inline-flex shrink-0 items-center rounded-full border border-dashed px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm',
                sel
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/35 hover:text-foreground',
              )}
            >
              {tCat('uncategorized')}
            </Link>
          )
        })()}
      </div>
    </section>
  )
}
