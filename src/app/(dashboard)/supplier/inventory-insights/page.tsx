import Link from 'next/link'
import { Warehouse } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { RetailerListPageHeader } from '@/components/retailer/retailer-list-page-header'
import { InventoryInsightsFilterChips } from '@/components/supplier/inventory-insights-filter-chips'
import { InventoryInsightsSummary } from '@/components/supplier/inventory-insights-summary'
import { InventoryInsightsTable } from '@/components/supplier/inventory-insights-table'
import { ListPagination } from '@/components/ui/list-pagination'
import {
  DEFAULT_LIST_PAGE_SIZE,
  parseListPagination,
} from '@/lib/data/pagination'
import { getSupplierInventoryInsightsPaged } from '@/lib/data/inventory-insights'

export default async function SupplierInventoryInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; filter?: string }>
}) {
  const t = await getTranslations('InventoryInsightsPage')
  const tReceive = await getTranslations('ReceiveStock')
  const sp = await searchParams
  const { page, pageSize } = parseListPagination(sp, {
    defaultPageSize: DEFAULT_LIST_PAGE_SIZE,
  })

  const res = await getSupplierInventoryInsightsPaged({
    page,
    pageSize,
    filter: sp.filter,
  })

  if ('error' in res) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {res.error}
      </div>
    )
  }

  const {
    rows,
    totalValuation,
    reorderFlaggedCount,
    lowStockCount,
    currencyCode,
    totalCount,
    totalPages,
    effectivePage,
    filter,
  } = res

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (filter !== 'all') p.set('filter', filter)
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_LIST_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/supplier/inventory-insights?${qs}` : '/supplier/inventory-insights'
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 sm:space-y-8">
      <RetailerListPageHeader
        icon={Warehouse}
        title={t('title')}
        subtitle={t('subtitle')}
      >
        <Link
          href="/supplier/products"
          className="inline-flex items-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
        >
          {t('manageProducts')}
        </Link>
        <Link
          href="/supplier/inventory/receive"
          className="inline-flex items-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
        >
          {tReceive('title')}
        </Link>
        <Link
          href="/supplier/finance"
          className="inline-flex items-center rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
        >
          {t('viewFinance')}
        </Link>
      </RetailerListPageHeader>

      <InventoryInsightsSummary
        totalValuation={totalValuation}
        reorderCount={reorderFlaggedCount}
        lowStockCount={lowStockCount}
        currencyCode={currencyCode}
        labels={{
          totalValuation: t('totalValuation'),
          valuationHint: t('valuationHint'),
          reorderCandidates: t('reorderCandidates'),
          reorderHint: t('reorderHint'),
          lowStock: t('lowStock'),
          lowStockHint: t('lowStockHint'),
          dataFreshness: t('dataFreshness'),
        }}
      />

      <InventoryInsightsFilterChips
        active={filter}
        reorderCount={reorderFlaggedCount}
        lowStockCount={lowStockCount}
        labels={{
          all: t('filterAll'),
          reorder: t('filterReorder'),
          lowStock: t('filterLowStock'),
          noSales: t('filterNoSales'),
          active: t('filterActive'),
        }}
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">{t('tableTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('tableHint')}</p>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-14 text-center sm:px-6">
            <p className="text-sm font-medium text-foreground">{t('emptyFiltered')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('emptyFilteredHint')}</p>
            {filter !== 'all' ? (
              <Link
                href="/supplier/inventory-insights"
                className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                {t('clearFilter')}
              </Link>
            ) : (
              <Link
                href="/supplier/products"
                className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                {t('addProducts')}
              </Link>
            )}
          </div>
        ) : (
          <div className="p-4 sm:p-6 sm:pt-4">
            <InventoryInsightsTable rows={rows} currencyCode={currencyCode} />
          </div>
        )}

        <ListPagination
          page={effectivePage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          buildHref={buildHref}
        />
      </section>
    </div>
  )
}
