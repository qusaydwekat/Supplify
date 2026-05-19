import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { BookOpen } from 'lucide-react'
import { LedgerTable } from '@/components/ledger/ledger-table'
import { LedgerPartnerFilter } from '@/components/ledger/ledger-partner-filter'
import { ListPagination } from '@/components/ui/list-pagination'
import { RetailerFinanceQuickNav } from '@/components/retailer/retailer-finance-quick-nav'
import { RetailerLedgerSummaryCards } from '@/components/retailer/retailer-ledger-summary-cards'
import { RetailerListPageHeader } from '@/components/retailer/retailer-list-page-header'
import { DEFAULT_LEDGER_PAGE_SIZE, parseListPagination } from '@/lib/data/pagination'
import { getRetailerLedgerPageData } from '@/lib/data/ledger'

export default async function RetailerLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ partnerId?: string; page?: string; pageSize?: string }>
}) {
  const t = await getTranslations('LedgerPage')
  const sp = await searchParams
  const partnerId = sp.partnerId?.trim() || null
  const { page, pageSize } = parseListPagination(sp, { defaultPageSize: DEFAULT_LEDGER_PAGE_SIZE })
  const res = await getRetailerLedgerPageData(partnerId, { load: 'page', page, pageSize })
  if ('error' in res) {
    return <p className="text-sm text-red-600">{t('errorWithDetails', { details: res.error })}</p>
  }

  const pag = res.pagination
  const ccy = res.displayCurrency

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (partnerId) p.set('partnerId', partnerId)
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_LEDGER_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/retailer/ledger?${qs}` : '/retailer/ledger'
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 sm:space-y-8">
      <RetailerListPageHeader icon={BookOpen} title={t('title')} subtitle={t('retailerSubtitle')} />

      <RetailerFinanceQuickNav active="ledger" />

      <Suspense fallback={<div className="h-11 animate-pulse rounded-2xl bg-muted" aria-hidden />}>
        <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-border/80 bg-background/90 px-1 py-2 backdrop-blur-md">
          <LedgerPartnerFilter
            options={res.filterOptions}
            activeId={res.activeFilterId}
            allLabel={t('allSuppliers')}
            selectLabel={t('filterBySupplier')}
          />
        </div>
      </Suspense>

      <RetailerLedgerSummaryCards
        totalInvoiced={res.totalInvoiced}
        totalCollected={res.totalCollected}
        netBalance={res.netBalance}
        currency={ccy}
      />

      <LedgerTable
        rows={res.rows}
        youLabel={t('retailerYou')}
        themLabel={t('retailerThem')}
        currency={ccy}
        role="retailer"
        footer={
          pag ? (
            <ListPagination
              page={pag.page}
              totalPages={pag.totalPages}
              totalCount={pag.totalCount}
              pageSize={pag.pageSize}
              buildHref={buildHref}
            />
          ) : null
        }
      />
    </div>
  )
}
