import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { supabaseServer } from '@/lib/supabase/server'
import { ListPagination } from '@/components/ui/list-pagination'
import {
  MarketplaceCategoryFilterChips,
  parseSelectedCatsFromParams,
} from '@/components/retailer/marketplace-category-filter'
import { MarketplaceSupplierListCard } from '@/components/retailer/marketplace-supplier-list-card'
import {
  clampPageToTotal,
  DEFAULT_MARKETPLACE_PAGE_SIZE,
  parseListPagination,
  totalPagesFromCount,
} from '@/lib/data/pagination'
import type { MarketplaceSupplierListRow } from '@/lib/data/marketplace-suppliers'
import { formatMoney } from '@/lib/format-money'
import { RetailerSearchEmpty } from '@/components/retailer/retailer-search-empty'
import { RetailerSearchResultsChrome } from '@/components/retailer/retailer-search-results-chrome'
import { RetailerSearchEmptyResults } from '@/components/retailer/retailer-search-empty-results'
import { RetailerSearchProductCard } from '@/components/retailer/retailer-search-product-card'
import {
  serializeCatsParam,
  isMarketplaceCategorySlug,
  type MarketplaceCategorySlug,
  UNCATEGORIZED_FILTER,
} from '@/lib/supplier-marketplace-categories'

type Tab = 'suppliers' | 'products'

function asTab(x: string | undefined): Tab {
  return x === 'products' ? 'products' : 'suppliers'
}

const SORT_VALUES = ['recommended', 'price_low', 'price_high', 'name'] as const
type ProductSort = (typeof SORT_VALUES)[number]

function asProductSort(x: string | undefined): ProductSort {
  return SORT_VALUES.includes(x as ProductSort) ? (x as ProductSort) : 'recommended'
}

type SuppliersBrowseRpcRow = MarketplaceSupplierListRow & {
  profile_business_name: string | null
  profile_city: string | null
  profile_name: string | null
  total_count: number
}

type ProductSearchRpcRow = {
  id: string
  name: string
  description: string | null
  category: string | null
  image_url: string | null
  supplier_id: string
  variation_min_price: string | number
  supplier_currency: string
  profile_business_name: string | null
  profile_city: string | null
  profile_name: string | null
  total_count: number
}

export default async function RetailerSearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    tab?: string
    page?: string
    pageSize?: string
    sort?: string
    cats?: string | string[]
  }>
}) {
  const t = await getTranslations('SearchPage')
  const tBrowse = await getTranslations('BrowsePage')
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const tab = asTab(sp.tab)
  const productSort = asProductSort(sp.sort)
  const { page, pageSize } = parseListPagination(sp, {
    defaultPageSize: DEFAULT_MARKETPLACE_PAGE_SIZE,
  })
  const selectedCats = parseSelectedCatsFromParams(sp.cats)
  const catsParam = serializeCatsParam(selectedCats) || null

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (tab !== 'suppliers') p.set('tab', tab)
    if (tab === 'products' && productSort !== 'recommended') p.set('sort', productSort)
    if (catsParam) p.set('cats', catsParam)
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_MARKETPLACE_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/retailer/search?${qs}` : '/retailer/search'
  }

  if (!q) {
    return <RetailerSearchEmpty />
  }

  if (tab === 'suppliers') {
    const tCat = await getTranslations('MarketplaceCategories')
    const categorySlugs = selectedCats.filter((x): x is MarketplaceCategorySlug =>
      isMarketplaceCategorySlug(x),
    )
    const includeUncategorized = selectedCats.includes(UNCATEGORIZED_FILTER)

    const fetchSuppliers = (offset: number) =>
      supabase.rpc('list_marketplace_suppliers_browse', {
        p_q: q || null,
        p_city: null,
        p_sort: 'recommended',
        p_category_slugs: categorySlugs.length ? categorySlugs : null,
        p_include_uncategorized: includeUncategorized,
        p_limit: pageSize,
        p_offset: offset,
      })

    let { data: browseRaw, error: supErr } = await fetchSuppliers((page - 1) * pageSize)
    if (supErr) {
      return (
        <p className="text-sm text-red-600">
          {tBrowse('loadErrorWithMessage', { message: supErr.message })}
        </p>
      )
    }

    let rowsRpc = (browseRaw ?? []) as SuppliersBrowseRpcRow[]
    const totalCount = rowsRpc.length ? Number(rowsRpc[0]?.total_count ?? 0) : 0
    const totalPages = totalPagesFromCount(totalCount, pageSize)
    const effectivePage = clampPageToTotal(page, totalPages)
    if (effectivePage !== page && totalCount > 0) {
      const r2 = await fetchSuppliers((effectivePage - 1) * pageSize)
      if (r2.error) {
        return (
          <p className="text-sm text-red-600">
            {tBrowse('loadErrorWithMessage', { message: r2.error.message })}
          </p>
        )
      }
      rowsRpc = (r2.data ?? []) as SuppliersBrowseRpcRow[]
    }

    const switchProductsHref = `/retailer/search?q=${encodeURIComponent(q)}&tab=products${
      catsParam ? `&cats=${encodeURIComponent(catsParam)}` : ''
    }`

    return (
      <RetailerSearchResultsChrome
        q={q}
        tab="suppliers"
        totalCount={totalCount}
        catsParam={catsParam}
        showCategoryFilters
        categoryFilters={
          <MarketplaceCategoryFilterChips mode="search" selectedCats={selectedCats} searchQuery={q} />
        }
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {rowsRpc.length === 0 ? (
            <RetailerSearchEmptyResults
              kind="suppliers"
              title={t('emptySuppliers')}
              hint={t('emptyTryProducts')}
              switchLabel={t('switchToProducts')}
              switchHref={switchProductsHref}
            />
          ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-5 lg:grid-cols-3">
              {rowsRpc.map((row) => {
                const {
                  profile_business_name,
                  profile_city,
                  profile_name,
                  total_count: _tc,
                  ...supplier
                } = row
                const name =
                  profile_business_name?.trim() ||
                  profile_name?.trim() ||
                  tBrowse('supplierFallback')
                return (
                  <MarketplaceSupplierListCard
                    key={supplier.id}
                    supplier={supplier}
                    businessName={name}
                    city={profile_city?.trim() || undefined}
                    tBrowse={tBrowse}
                    tCat={tCat}
                  />
                )
              })}
            </div>
          )}
          <ListPagination
            page={effectivePage}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            buildHref={buildHref}
          />
        </div>
      </RetailerSearchResultsChrome>
    )
  }

  const fetchProducts = (offset: number) =>
    supabase.rpc('search_marketplace_products_paged', {
      p_q: q,
      p_sort: productSort,
      p_limit: pageSize,
      p_offset: offset,
    })

  let { data: prodRpcRaw, error: prodErr } = await fetchProducts((page - 1) * pageSize)
  if (prodErr) {
    return (
      <p className="text-sm text-red-600">
        {tBrowse('loadErrorWithMessage', { message: prodErr.message })}
      </p>
    )
  }

  let prodRowsRpc = (prodRpcRaw ?? []) as ProductSearchRpcRow[]
  const totalCount = prodRowsRpc.length ? Number(prodRowsRpc[0]?.total_count ?? 0) : 0
  const totalPages = totalPagesFromCount(totalCount, pageSize)
  const effectivePage = clampPageToTotal(page, totalPages)
  if (effectivePage !== page && totalCount > 0) {
    const r2 = await fetchProducts((effectivePage - 1) * pageSize)
    if (r2.error) {
      return (
        <p className="text-sm text-red-600">
          {tBrowse('loadErrorWithMessage', { message: r2.error.message })}
        </p>
      )
    }
    prodRowsRpc = (r2.data ?? []) as ProductSearchRpcRow[]
  }

  const switchSuppliersHref = `/retailer/search?q=${encodeURIComponent(q)}&tab=suppliers${
    catsParam ? `&cats=${encodeURIComponent(catsParam)}` : ''
  }`

  return (
    <RetailerSearchResultsChrome
      q={q}
      tab="products"
      totalCount={totalCount}
      catsParam={catsParam}
      productSort={productSort}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {prodRowsRpc.length === 0 ? (
          <RetailerSearchEmptyResults
            kind="products"
            title={t('emptyProducts')}
            hint={t('emptyTrySuppliers')}
            switchLabel={t('switchToSuppliers')}
            switchHref={switchSuppliersHref}
          />
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:gap-5 sm:p-5 lg:grid-cols-3">
            {prodRowsRpc.map((p) => {
              const label =
                p.profile_business_name?.trim() ||
                p.profile_name?.trim() ||
                tBrowse('supplierFallback')
              const city = p.profile_city?.trim() ?? ''
              const ccy = String(p.supplier_currency ?? 'USD')
              const min = Number(p.variation_min_price)
              const hasPrice = Number.isFinite(min) && min > 0
              return (
                <RetailerSearchProductCard
                  key={p.id}
                  name={p.name}
                  description={p.description}
                  category={p.category}
                  imageUrl={p.image_url}
                  supplierId={p.supplier_id}
                  supplierLabel={label}
                  city={city || undefined}
                  priceBadge={hasPrice ? t('fromPrice', { price: formatMoney(min, ccy) }) : null}
                  viewStoreLabel={t('viewStore')}
                  noImageLabel={t('noImage')}
                />
              )
            })}
          </div>
        )}
        <ListPagination
          page={effectivePage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          buildHref={buildHref}
        />
      </div>
    </RetailerSearchResultsChrome>
  )
}
