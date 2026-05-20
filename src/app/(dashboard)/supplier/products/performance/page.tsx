import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { TrendingUp } from 'lucide-react'
import { RetailerListPageHeader } from '@/components/retailer/retailer-list-page-header'
import { InventoryInsightsFilterChips } from '@/components/supplier/inventory-insights-filter-chips'
import { InventoryInsightsSummary } from '@/components/supplier/inventory-insights-summary'
import { InventoryInsightsTable } from '@/components/supplier/inventory-insights-table'
import { ListPagination } from '@/components/ui/list-pagination'
import { DEFAULT_LIST_PAGE_SIZE, parseListPagination } from '@/lib/data/pagination'
import { getSupplierInventoryInsightsPaged } from '@/lib/data/inventory-insights'

export default async function SupplierProductPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; filter?: string }>
}) {
  const t = await getTranslations('ProductPerformance')
  const sp = await searchParams
  const { page, pageSize } = parseListPagination(sp, { defaultPageSize: DEFAULT_LIST_PAGE_SIZE })

  const filter = sp.filter === 'no_sales' || sp.filter === 'reorder' || sp.filter === 'low_stock' ? sp.filter : 'active'

  const res = await getSupplierInventoryInsightsPaged({ page, pageSize, filter })

  if ('error' in res) {
    return <p className="text-sm text-red-600">{res.error}</p>
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
  } = res

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (filter !== 'active') p.set('filter', filter)
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_LIST_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/supplier/products/performance?${qs}` : '/supplier/products/performance'
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <RetailerListPageHeader icon={TrendingUp} title={t('title')} subtitle={t('subtitle')}>
        <Link
          href="/supplier/inventory/receive"
          className="inline-flex items-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted"
        >
          {t('receiveStock')}
        </Link>
        <Link
          href="/supplier/products"
          className="inline-flex items-center rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15"
        >
          {t('manageProducts')}
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
        basePath="/supplier/products/performance"
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">{t('tableTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('tableHint')}</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="p-4 sm:p-6">
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
