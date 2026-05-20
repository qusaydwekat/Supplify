import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { requireRequestUserId } from '@/lib/auth/request-session'
import { ProductsListTable } from '@/components/products/products-list-table'
import { countIncompleteCatalogProducts } from '@/lib/data/products/catalog-discoverability'
import { getSupplierProductListStats, listSupplierProducts } from '@/lib/data/products/list-products'
import { MARKETPLACE_CATEGORY_SLUGS } from '@/lib/supplier-marketplace-categories'
import type { ProductCatalogStatus } from '@/lib/types/products'

const PAGE_SIZE = 20

type Search = {
  q?: string
  page?: string
  category?: string
  status?: string
  catalog?: string
  lowStock?: string
  sort?: string
}

export default async function SupplierProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const t = await getTranslations('ProductsPage')
  const tCommon = await getTranslations('Common')
  const tCat = await getTranslations('MarketplaceCategories')
  const sp = await searchParams
  await requireRequestUserId()

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''
  const category = sp.category?.trim() ?? ''
  const status = (sp.status ?? 'all') as 'all' | 'active' | 'inactive'
  const catalog = (sp.catalog ?? 'all') as ProductCatalogStatus | 'all'
  const lowStockOnly = sp.lowStock === '1'
  const sort = (sp.sort ?? 'updated_desc') as 'updated_desc' | 'name_asc' | 'name_desc' | 'stock_asc'

  const filters = {
    search: q,
    marketplaceCategory: category,
    status,
    catalogStatus: catalog,
    lowStockOnly,
    sort,
    page,
    pageSize: PAGE_SIZE,
  }

  const [{ rows, total, error }, { stats }, incompleteCount] = await Promise.all([
    listSupplierProducts(filters),
    getSupplierProductListStats(filters),
    countIncompleteCatalogProducts(),
  ])

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {t('loadErrorWithMessage', { message: error })}
      </div>
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildQuery = (nextPage?: number) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (category) p.set('category', category)
    if (status && status !== 'all') p.set('status', status)
    if (catalog && catalog !== 'all') p.set('catalog', catalog)
    if (lowStockOnly) p.set('lowStock', '1')
    if (sort && sort !== 'updated_desc') p.set('sort', sort)
    if (nextPage && nextPage > 1) p.set('page', String(nextPage))
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  const exportHref = `/api/supplier/products/export${buildQuery()}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/supplier/products/new"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          {t('addProduct')}
        </Link>
      </div>

      {incompleteCount > 0 ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-950 shadow-sm">
          <p className="font-semibold">{t('discoverabilityTitle')}</p>
          <p className="mt-1 text-sky-900">{t('discoverabilityHint', { count: incompleteCount })}</p>
          <Link
            href="/supplier/products?catalog=draft"
            className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-sky-900 px-3 text-xs font-semibold text-white transition hover:bg-sky-800"
          >
            {t('discoverabilityAction')}
          </Link>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm shadow-slate-900/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('statTotal')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{stats.totalProducts}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm shadow-slate-900/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('statActive')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{stats.activeProducts}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{t('statDrafts')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{stats.draftProducts}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">{t('statLowStock')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-950">{stats.lowStockProducts}</p>
        </div>
      </section>

      <form method="get" className="app-surface-muted flex flex-wrap items-end gap-3 p-4 sm:p-5">
        <div className="min-w-[min(100%,12rem)] flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('search')}</label>
          <input
            name="q"
            defaultValue={q}
            placeholder={t('searchPlaceholder')}
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="w-full min-w-0 sm:w-48">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('category')}</label>
          <select
            name="category"
            defaultValue={category}
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{t('categoryAll')}</option>
            {MARKETPLACE_CATEGORY_SLUGS.map((slug) => (
              <option key={slug} value={slug}>
                {tCat(slug)}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-36">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('status')}</label>
          <select
            name="status"
            defaultValue={status}
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">{t('statusAll')}</option>
            <option value="active">{t('statusActive')}</option>
            <option value="inactive">{t('statusInactive')}</option>
          </select>
        </div>
        <div className="w-full sm:w-36">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('catalog')}</label>
          <select
            name="catalog"
            defaultValue={catalog}
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">{t('catalogAll')}</option>
            <option value="draft">{t('catalogDraft')}</option>
            <option value="published">{t('catalogPublished')}</option>
            <option value="archived">{t('catalogArchived')}</option>
          </select>
        </div>
        <div className="w-full sm:w-40">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('sort')}</label>
          <select
            name="sort"
            defaultValue={sort}
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="updated_desc">{t('sortUpdated')}</option>
            <option value="name_asc">{t('sortNameAsc')}</option>
            <option value="name_desc">{t('sortNameDesc')}</option>
            <option value="stock_asc">{t('sortStockAsc')}</option>
          </select>
        </div>
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm">
          <input type="checkbox" name="lowStock" value="1" defaultChecked={lowStockOnly} />
          <span className="text-sm">{t('lowStockOnly')}</span>
        </label>
        <button
          type="submit"
          className="min-h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto"
        >
          {tCommon('filter')}
        </button>
        {(q ||
          category ||
          (status && status !== 'all') ||
          (catalog && catalog !== 'all') ||
          lowStockOnly ||
          sort !== 'updated_desc') && (
          <Link
            href="/supplier/products"
            className="min-h-10 w-full rounded-lg border border-border bg-card px-4 py-2 text-center text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted sm:w-auto"
          >
            {t('clearFilters')}
          </Link>
        )}
      </form>

      <ProductsListTable rows={rows} exportHref={exportHref} />

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{t('pageOf', { page, pages: totalPages, total })}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/supplier/products${buildQuery(page - 1)}`}
              className="rounded-lg border border-border bg-card px-3 py-2 font-medium text-foreground transition hover:bg-muted"
            >
              {tCommon('previous')}
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/supplier/products${buildQuery(page + 1)}`}
              className="rounded-lg border border-border bg-card px-3 py-2 font-medium text-foreground transition hover:bg-muted"
            >
              {tCommon('next')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
