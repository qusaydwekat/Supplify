import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { NewInvoiceForm } from '@/components/invoices/new-invoice-form'
import { ListPagination } from '@/components/ui/list-pagination'
import { DEFAULT_LIST_PAGE_SIZE, parseListPagination } from '@/lib/data/pagination'
import { listDeliveredOrdersForInvoicing } from '@/lib/data/invoices'

export default async function SupplierNewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; page?: string; pageSize?: string }>
}) {
  const t = await getTranslations('NewInvoicePage')
  const tCommon = await getTranslations('Common')
  const sp = await searchParams
  const { orderId } = sp
  const { page, pageSize } = parseListPagination(sp)
  const res = await listDeliveredOrdersForInvoicing({ page, pageSize })
  if ('error' in res) {
    return <p className="text-sm text-red-600">{tCommon('loadErrorDetails', { details: res.error })}</p>
  }

  const defaultOrderId = orderId && res.rows.some((o) => o.id === orderId) ? orderId : res.rows[0]?.id ?? null

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (orderId && res.rows.some((o) => o.id === orderId)) p.set('orderId', orderId)
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_LIST_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/supplier/invoices/new?${qs}` : '/supplier/invoices/new'
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/supplier/invoices" className="text-sm text-slate-600 hover:text-slate-900 hover:underline">
          ← {t('backInvoices')}
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
      </div>
      <NewInvoiceForm orders={res.rows} defaultOrderId={defaultOrderId} />
      <ListPagination
        page={res.page}
        totalPages={res.totalPages}
        totalCount={res.totalCount}
        pageSize={res.pageSize}
        buildHref={buildHref}
      />
    </div>
  )
}
