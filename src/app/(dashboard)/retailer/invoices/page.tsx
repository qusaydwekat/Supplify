import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { FileText } from 'lucide-react'
import { InvoiceTable } from '@/components/invoices/invoice-table'
import { ListPagination } from '@/components/ui/list-pagination'
import { RetailerFinanceQuickNav } from '@/components/retailer/retailer-finance-quick-nav'
import { RetailerListPageHeader } from '@/components/retailer/retailer-list-page-header'
import { DEFAULT_LIST_PAGE_SIZE, parseListPagination } from '@/lib/data/pagination'
import { getRetailerInvoiceList } from '@/lib/data/invoices'

export const dynamic = 'force-dynamic'

export default async function RetailerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const t = await getTranslations('InvoicesList')
  const tCommon = await getTranslations('Common')
  const sp = await searchParams
  const { page, pageSize } = parseListPagination(sp)
  const res = await getRetailerInvoiceList({ page, pageSize })
  if ('error' in res) {
    return <p className="text-sm text-red-600">{tCommon('loadErrorDetails', { details: res.error })}</p>
  }

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_LIST_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/retailer/invoices?${qs}` : '/retailer/invoices'
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 sm:space-y-8">
      <RetailerListPageHeader icon={FileText} title={t('retailerTitle')} subtitle={t('retailerSubtitle')}>
        <Link
          href="/retailer/ledger"
          className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
        >
          {t('viewLedger')}
        </Link>
      </RetailerListPageHeader>
      <RetailerFinanceQuickNav active="invoices" />
      <InvoiceTable
        rows={res.rows}
        basePath="/retailer/invoices"
        footer={
          <ListPagination
            page={res.page}
            totalPages={res.totalPages}
            totalCount={res.totalCount}
            pageSize={res.pageSize}
            buildHref={buildHref}
          />
        }
      />
    </div>
  )
}
