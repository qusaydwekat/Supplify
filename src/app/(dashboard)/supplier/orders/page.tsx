import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { OrderTable } from '@/components/orders/order-table'
import { SupplierOrderFilters } from '@/components/orders/supplier-order-filters'
import { ListPagination } from '@/components/ui/list-pagination'
import { DEFAULT_LIST_PAGE_SIZE, parseListPagination } from '@/lib/data/pagination'
import { getSupplierOrderList } from '@/lib/data/orders'

export default async function SupplierOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; status?: string; q?: string; from?: string; to?: string }>
}) {
  const t = await getTranslations('OrdersList')
  const tCommon = await getTranslations('Common')
  const sp = await searchParams
  const { page, pageSize } = parseListPagination(sp)
  const res = await getSupplierOrderList({
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
    return qs ? `/supplier/orders?${qs}` : '/supplier/orders'
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('supplierTitle')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('supplierSubtitle')}</p>
      </div>

      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-slate-200" aria-hidden />}>
        <SupplierOrderFilters />
      </Suspense>

      <OrderTable
        rows={res.rows}
        basePath="/supplier/orders"
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
