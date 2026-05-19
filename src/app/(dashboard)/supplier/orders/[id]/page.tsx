import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { OrderLineItems } from '@/components/orders/order-line-items'
import { SupplierAssignedDelivery } from '@/components/delivery/supplier-assigned-delivery'
import { SupplierOrderPanel } from '@/components/orders/supplier-order-panel'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { getInvoiceForOrder } from '@/lib/data/invoices'
import { formatMoney } from '@/lib/format-money'
import { getSupplierOrderDetail } from '@/lib/data/orders'
import { getOrderAuditLog } from '@/lib/data/audit-log'
import { OrderMessagesBlock } from '@/components/orders/order-messages-block'
import { OrderActivitySection } from '@/components/orders/order-activity-section'
import { WhatsAppShareButton } from '@/components/share/whatsapp-share-button'
import { CodCollectButton } from '@/components/orders/cod-collect-button'

export default async function SupplierOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations('OrderDetailPage')
  const tCommon = await getTranslations('Common')
  const { id } = await params
  const res = await getSupplierOrderDetail(id)

  if ('error' in res) {
    if (res.error === 'Order not found' || res.error === 'Forbidden') notFound()
    return <p className="text-sm text-red-600">{tCommon('loadErrorDetails', { details: res.error })}</p>
  }

  const { order } = res
  const invoice = order.status === 'delivered' ? await getInvoiceForOrder(order.id) : null
  const codCollected =
    order.is_cod && order.status === 'delivered' && invoice?.status === 'paid'

  const auditRes = await getOrderAuditLog(order.id)
  const audit = 'error' in auditRes ? [] : auditRes

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/supplier/orders" className="text-sm text-slate-600 hover:text-slate-900 hover:underline">
            ← {t('backOrders')}
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{order.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <WhatsAppShareButton
            phone={order.retailerProfile.phone ?? undefined}
            message={t('whatsappOrderMessage', {
              orderId: order.id.slice(0, 8),
              total: formatMoney(order.total_price, order.currency_code),
              counterparty: order.retailerProfile.business_name,
            })}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{t('retailerSection')}</h2>
            <p className="mt-2 text-sm text-slate-800">{order.retailerProfile.business_name}</p>
            <p className="text-sm text-slate-600">{order.retailerProfile.name}</p>
            <div className="mt-2 text-xs text-slate-500">
              {order.retailerProfile.city ? <span>{order.retailerProfile.city}</span> : null}
              {order.retailerProfile.phone ? <span className="ms-2">{order.retailerProfile.phone}</span> : null}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">{t('lineItems')}</h2>
            <OrderLineItems items={order.items} currencyCode={order.currency_code} />
            <div className="flex justify-end border-t border-slate-200 pt-3 text-sm">
              <span className="text-slate-600">{t('orderTotal')}</span>
              <span className="ms-4 font-semibold text-slate-900">{formatMoney(order.total_price, order.currency_code)}</span>
            </div>
          </section>

          {order.notes ? (
            <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <h2 className="text-sm font-semibold text-slate-900">{t('notesFromRetailer')}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{order.notes}</p>
            </section>
          ) : null}

          <SupplierAssignedDelivery
            orderId={order.id}
            status={order.status}
            person={order.deliveryPerson}
          />

          {order.is_cod ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{t('codBadge')}</h2>
                  <p className="mt-1 text-xs text-slate-600">{t('codSupplierHint')}</p>
                </div>
                {order.status === 'delivered' ? (
                  <CodCollectButton orderId={order.id} collected={codCollected} />
                ) : null}
              </div>
            </section>
          ) : null}

          {order.status === 'delivered' ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <h2 className="text-sm font-semibold text-slate-900">{t('billingTitle')}</h2>
              {invoice ? (
                <p className="mt-2 text-sm text-slate-700">
                  {t('invoiceCreatedBefore')}{' '}
                  <Link href={`/supplier/invoices/${invoice.id}`} className="font-medium text-slate-900 underline">
                    {invoice.invoice_number}
                  </Link>{' '}
                  {t('invoiceCreatedAfter')}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-700">
                  {t('deliveredInvoiceHint')}{' '}
                  <Link
                    href={`/supplier/invoices/new?orderId=${order.id}`}
                    className="font-medium text-slate-900 underline"
                  >
                    {t('createInvoice')}
                  </Link>
                </p>
              )}
            </section>
          ) : null}

          <OrderMessagesBlock orderId={order.id} />
          <OrderActivitySection
            status={order.status}
            createdAt={order.created_at}
            audit={audit}
            currencyCode={order.currency_code}
          />
        </div>

        <SupplierOrderPanel orderId={order.id} status={order.status} items={order.items} />
      </div>
    </div>
  )
}
