import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ListPagination } from '@/components/ui/list-pagination'
import { MarketplaceCategoryFilterChips, parseSelectedCatsFromParams } from '@/components/retailer/marketplace-category-filter'
import { MarketplaceSupplierListCard } from '@/components/retailer/marketplace-supplier-list-card'
import {
  clampPageToTotal,
  DEFAULT_MARKETPLACE_PAGE_SIZE,
  parseListPagination,
  totalPagesFromCount,
} from '@/lib/data/pagination'
import type { MarketplaceSupplierListRow } from '@/lib/data/marketplace-suppliers'
import {
  isMarketplaceCategorySlug,
  type MarketplaceCategorySlug,
  UNCATEGORIZED_FILTER,
  serializeCatsParam,
} from '@/lib/supplier-marketplace-categories'
import { supabaseServer } from '@/lib/supabase/server'

type SuppliersBrowseRpcRow = MarketplaceSupplierListRow & {
  profile_business_name: string | null
  profile_city: string | null
  profile_name: string | null
  total_count: number
}

export default async function RetailerBrowseSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    page?: string
    pageSize?: string
    sort?: string
    city?: string
    cats?: string | string[]
  }>
}) {
  const t = await getTranslations('BrowsePage')
  const tCat = await getTranslations('MarketplaceCategories')
  const sp = await searchParams
  const q = sp.q ?? ''
  const city = sp.city ?? ''
  const sort = sp.sort ?? 'recommended'
  const selectedCats = parseSelectedCatsFromParams(sp.cats)
  const { page, pageSize } = parseListPagination(sp, { defaultPageSize: DEFAULT_MARKETPLACE_PAGE_SIZE })
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const categorySlugs = selectedCats.filter((x): x is MarketplaceCategorySlug => isMarketplaceCategorySlug(x))
  const includeUncategorized = selectedCats.includes(UNCATEGORIZED_FILTER)

  const fetchBrowse = (offset: number) =>
    supabase.rpc('list_marketplace_suppliers_browse', {
      p_q: q.trim() || null,
      p_city: city.trim() || null,
      p_sort: sort,
      p_category_slugs: categorySlugs.length ? categorySlugs : null,
      p_include_uncategorized: includeUncategorized,
      p_limit: pageSize,
      p_offset: offset,
    })

  let { data: browseRaw, error } = await fetchBrowse((page - 1) * pageSize)
  if (error) {
    return <p className="text-sm text-red-600">{t('loadErrorWithMessage', { message: error.message })}</p>
  }

  let rowsRpc = (browseRaw ?? []) as SuppliersBrowseRpcRow[]
  const totalCount = rowsRpc.length ? Number(rowsRpc[0]?.total_count ?? 0) : 0
  const totalPages = totalPagesFromCount(totalCount, pageSize)
  const effectivePage = clampPageToTotal(page, totalPages)
  if (effectivePage !== page && totalCount > 0) {
    const r2 = await fetchBrowse((effectivePage - 1) * pageSize)
    if (r2.error) {
      return <p className="text-sm text-red-600">{t('loadErrorWithMessage', { message: r2.error.message })}</p>
    }
    rowsRpc = (r2.data ?? []) as SuppliersBrowseRpcRow[]
  }

  const catsSerialized = serializeCatsParam(selectedCats)

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (q.trim()) p.set('q', q.trim())
    if (city.trim()) p.set('city', city.trim())
    if (sort && sort !== 'recommended') p.set('sort', sort)
    if (catsSerialized) p.set('cats', catsSerialized)
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_MARKETPLACE_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/retailer/browse?${qs}` : '/retailer/browse'
  }

  const hasTextOrCityFilters = !!(q.trim() || city.trim() || (sort && sort !== 'recommended'))
  const hasAnyFilter = hasTextOrCityFilters || selectedCats.length > 0

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-7">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{t('title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{t('subtitle')}</p>
        <form method="get" className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
          {catsSerialized ? <input type="hidden" name="cats" value={catsSerialized} /> : null}
          <div className="min-w-0 flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('search')}</label>
            <input
              name="q"
              defaultValue={q}
              placeholder={t('searchPlaceholder')}
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="w-full sm:w-52">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('city')}</label>
            <input
              name="city"
              defaultValue={city}
              placeholder={t('cityPlaceholder')}
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="w-full sm:w-48">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('sort')}</label>
            <select
              name="sort"
              defaultValue={sort}
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="recommended">{t('sortRecommended')}</option>
              <option value="rating">{t('sortRating')}</option>
              <option value="name">{t('sortName')}</option>
            </select>
          </div>
          <button
            type="submit"
            className="min-h-10 w-full rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto"
          >
            {t('apply')}
          </button>
        </form>
      </div>

      <MarketplaceCategoryFilterChips
        mode="browse"
        selectedCats={selectedCats}
        browseQ={q}
        browseCity={city}
        browseSort={sort}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">{t('resultsCount', { count: totalCount })}</p>
        {hasAnyFilter ? (
          <Link href="/retailer/browse" className="font-medium text-primary underline-offset-2 hover:underline">
            {t('clearFilters')}
          </Link>
        ) : null}
      </div>

      <div className="app-surface">
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          {rowsRpc.map((row) => {
            const {
              profile_business_name: _pb,
              profile_city,
              profile_name: pn,
              total_count: _tc,
              ...supplier
            } = row
            const name =
              row.profile_business_name?.trim() ||
              pn?.trim() ||
              t('supplierFallback')
            return (
              <MarketplaceSupplierListCard
                key={supplier.id}
                supplier={supplier as MarketplaceSupplierListRow}
                businessName={name}
                city={profile_city?.trim() || undefined}
                tBrowse={t}
                tCat={tCat}
              />
            )
          })}
        </div>
        {rowsRpc.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('empty')}</p> : null}
        <ListPagination
          page={effectivePage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          buildHref={buildHref}
        />
      </div>
    </div>
  )
}
