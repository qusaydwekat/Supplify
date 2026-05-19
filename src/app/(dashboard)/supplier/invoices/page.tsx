import Link from 'next/link'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { InvoiceTable } from '@/components/invoices/invoice-table'
import { SupplierInvoiceFilters } from '@/components/invoices/supplier-invoice-filters'
import { ListPagination } from '@/components/ui/list-pagination'
import { DEFAULT_LIST_PAGE_SIZE, parseListPagination } from '@/lib/data/pagination'
import { getSupplierInvoiceList } from '@/lib/data/invoices'

export default async function SupplierInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; status?: string; q?: string; from?: string; to?: string }>
}) {
  const t = await getTranslations('InvoicesList')
  const tCommon = await getTranslations('Common')
  const sp = await searchParams
  const { page, pageSize } = parseListPagination(sp)
  const res = await getSupplierInvoiceList({
    page,
    pageSize,
    status: sp.status ?? null,
    search: sp.q ?? null,
    dateFrom: sp.from ?? null,
    dateTo: sp.to ?? null,
  })
  if ('error' in res) {
    return <p className="text-sm text-red-600">{tCommon('loadErrorDetails', { details: res.error })}</p>
  }

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (sp.status?.trim()) p.set('status', sp.status.trim())
    if (sp.q?.trim()) p.set('q', sp.q.trim())
    if (sp.from?.trim()) p.set('from', sp.from.trim())
    if (sp.to?.trim()) p.set('to', sp.to.trim())
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_LIST_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/supplier/invoices?${qs}` : '/supplier/invoices'
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('supplierTitle')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('supplierListLead')}</p>
        </div>
        <Link
          href="/supplier/invoices/new"
          className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
        >
          {t('newInvoice')}
        </Link>
      </div>

      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-slate-200" aria-hidden />}>
        <SupplierInvoiceFilters />
      </Suspense>

      <InvoiceTable
        rows={res.rows}
        basePath="/supplier/invoices"
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
