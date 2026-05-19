import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { CircleDollarSign } from 'lucide-react'
import { RetailerPaymentsTable } from '@/components/payments/retailer-payments-table'
import { ListPagination } from '@/components/ui/list-pagination'
import { RetailerFinanceQuickNav } from '@/components/retailer/retailer-finance-quick-nav'
import { RetailerListPageHeader } from '@/components/retailer/retailer-list-page-header'
import { DEFAULT_LIST_PAGE_SIZE, parseListPagination } from '@/lib/data/pagination'
import { loadCurrencyConversionState } from '@/lib/currency'
import { getRetailerPaymentHistory } from '@/lib/data/payments'
import { supabaseServer } from '@/lib/supabase/server'

export default async function RetailerPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const t = await getTranslations('PaymentsList')
  const tCommon = await getTranslations('Common')
  const sp = await searchParams
  const { page, pageSize } = parseListPagination(sp)
  const res = await getRetailerPaymentHistory({ page, pageSize })
  if ('error' in res) {
    return <p className="text-sm text-red-600">{tCommon('loadErrorDetails', { details: res.error })}</p>
  }

  const supabase = supabaseServer()
  const conv = await loadCurrencyConversionState(supabase)
  const defaultAppCurrency = 'error' in conv ? 'USD' : conv.defaultCurrency

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_LIST_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/retailer/payments?${qs}` : '/retailer/payments'
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 sm:space-y-8">
      <RetailerListPageHeader icon={CircleDollarSign} title={t('retailerTitle')} subtitle={t('retailerSubtitle')}>
        <Link
          href="/retailer/invoices"
          className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
        >
          {t('linkRetailerInvoices')}
        </Link>
      </RetailerListPageHeader>
      <RetailerFinanceQuickNav active="payments" />
      <div className="rounded-2xl border border-sky-200/80 bg-sky-50/60 p-4 shadow-sm dark:border-sky-900/40 dark:bg-sky-950/25 sm:p-5">
        <p className="text-sm font-semibold text-foreground">{t('retailerPaymentsTipTitle')}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t('retailerPaymentsTipBody')}</p>
      </div>
      <RetailerPaymentsTable
        rows={res.rows}
        defaultAppCurrency={defaultAppCurrency}
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
