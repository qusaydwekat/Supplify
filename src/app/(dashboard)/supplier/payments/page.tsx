import Link from 'next/link'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { SupplierPaymentsTable } from '@/components/payments/supplier-payments-table'
import { SupplierPaymentFilters } from '@/components/payments/supplier-payment-filters'
import { ListPagination } from '@/components/ui/list-pagination'
import { DEFAULT_LIST_PAGE_SIZE, parseListPagination } from '@/lib/data/pagination'
import { convertBetween, loadCurrencyConversionState, roundMoney2 } from '@/lib/currency'
import { requireRequestUserId } from '@/lib/auth/request-session'
import { getSupplierPaymentHistory } from '@/lib/data/payments'
import { supabaseServer } from '@/lib/supabase/server'

export default async function SupplierPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; from?: string; to?: string; page?: string; pageSize?: string }>
}) {
  const t = await getTranslations('PaymentsList')
  const tCommon = await getTranslations('Common')
  const sp = await searchParams
  const { page, pageSize } = parseListPagination(sp)
  const res = await getSupplierPaymentHistory(
    {
      method: sp.method ?? null,
      dateFrom: sp.from ?? null,
      dateTo: sp.to ?? null,
    },
    { page, pageSize },
  )
  if ('error' in res) {
    return <p className="text-sm text-red-600">{tCommon('loadErrorDetails', { details: res.error })}</p>
  }

  const supabase = supabaseServer()
  const conv = await loadCurrencyConversionState(supabase)
  const defaultAppCurrency = 'error' in conv ? 'USD' : conv.defaultCurrency

  const userId = await requireRequestUserId()
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('currency_code')
    .eq('user_id', userId)
    .maybeSingle()
  const storeCurrency = String((supplier as { currency_code?: string } | null)?.currency_code ?? defaultAppCurrency).toUpperCase()

  const pageTotalAmount =
    'error' in conv
      ? roundMoney2(res.rows.reduce((s, r) => s + r.amount_in_default_currency, 0))
      : roundMoney2(res.rows.reduce((s, r) => s + convertBetween(r.amount_in_default_currency, defaultAppCurrency, storeCurrency, conv), 0))

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (sp.method?.trim()) p.set('method', sp.method.trim())
    if (sp.from?.trim()) p.set('from', sp.from.trim())
    if (sp.to?.trim()) p.set('to', sp.to.trim())
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_LIST_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/supplier/payments?${qs}` : '/supplier/payments'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('supplierTitle')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('supplierSubtitle')}</p>
        </div>
        <Link
          href="/supplier/invoices"
          className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          {t('linkSupplierInvoices')}
        </Link>
      </div>

      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-slate-200" aria-hidden />}>
        <SupplierPaymentFilters />
      </Suspense>

      <SupplierPaymentsTable
        rows={res.rows}
        pageTotalAmount={pageTotalAmount}
        pageTotalCurrency={storeCurrency}
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
