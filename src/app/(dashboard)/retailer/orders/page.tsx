import { getTranslations } from 'next-intl/server'
import { ShoppingCart } from 'lucide-react'
import { OrderTable } from '@/components/orders/order-table'
import { ListPagination } from '@/components/ui/list-pagination'
import { RetailerFinanceQuickNav } from '@/components/retailer/retailer-finance-quick-nav'
import { RetailerListPageHeader } from '@/components/retailer/retailer-list-page-header'
import { DEFAULT_LIST_PAGE_SIZE, parseListPagination } from '@/lib/data/pagination'
import { getRetailerOrderList } from '@/lib/data/orders'

export default async function RetailerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const t = await getTranslations('OrdersList')
  const tCommon = await getTranslations('Common')
  const sp = await searchParams
  const { page, pageSize } = parseListPagination(sp)
  const res = await getRetailerOrderList({ page, pageSize })
  if ('error' in res) {
    return <p className="text-sm text-red-600">{tCommon('loadErrorDetails', { details: res.error })}</p>
  }

  const buildHref = (nextPage: number) => {
    const p = new URLSearchParams()
    if (nextPage > 1) p.set('page', String(nextPage))
    if (pageSize !== DEFAULT_LIST_PAGE_SIZE) p.set('pageSize', String(pageSize))
    const qs = p.toString()
    return qs ? `/retailer/orders?${qs}` : '/retailer/orders'
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 sm:space-y-8">
      <RetailerListPageHeader icon={ShoppingCart} title={t('retailerTitle')} subtitle={t('retailerSubtitle')} />
      <RetailerFinanceQuickNav active="orders" />
      <OrderTable
        rows={res.rows}
        basePath="/retailer/orders"
        showReorder
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
