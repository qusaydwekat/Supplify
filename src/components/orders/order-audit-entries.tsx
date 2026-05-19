import { getLocale, getTranslations } from 'next-intl/server'
import type { AuditLogRow } from '@/lib/data/audit-log'
import { formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { formatMoney } from '@/lib/format-money'

type LineChange = {
  product_label: string
  old_quantity: number
  new_quantity: number
  old_unit_price: number
  new_unit_price: number
}

type PaymentAuditEvent = 'payment_recorded' | 'payment_updated' | 'payment_deleted'

function paymentAuditKey(event: PaymentAuditEvent): 'paymentRecorded' | 'paymentUpdated' | 'paymentDeleted' {
  switch (event) {
    case 'payment_recorded':
      return 'paymentRecorded'
    case 'payment_updated':
      return 'paymentUpdated'
    case 'payment_deleted':
      return 'paymentDeleted'
  }
}

const STATUS_EVENT_KEY: Record<string, string> = {
  order_accepted: 'orderAccepted',
  order_rejected: 'orderRejected',
  order_cancelled_by_retailer: 'orderCancelledByRetailer',
  order_modification_confirmed: 'orderModificationConfirmed',
  order_status_preparing: 'orderPreparing',
  order_status_delivered: 'orderDelivered',
}

type Props = {
  audit: AuditLogRow[]
  currencyCode: string
  /** Audit log rows are usually newest-first from the API; pick sort for display. */
  sortOrder: 'asc' | 'desc'
}

/** Renders `<li>` rows for use inside a parent `<ul>`. */
export async function OrderAuditEntries({ audit, currencyCode, sortOrder }: Props) {
  if (!audit.length) return null

  const t = await getTranslations('OrderAudit')
  const locale = normalizeAppLocale(await getLocale())
  const fmt = (d: string) => formatDateTimeShort(d, locale)

  const sorted = [...audit].sort((a, b) => {
    const ta = new Date(a.created_at).getTime()
    const tb = new Date(b.created_at).getTime()
    return sortOrder === 'asc' ? ta - tb : tb - ta
  })

  return sorted.map((row) => {
    const rawLines = row.event_type === 'order_lines_modified' ? row.metadata.lines : null
    const lines = Array.isArray(rawLines) ? (rawLines as LineChange[]) : []

    const paymentEvent: PaymentAuditEvent | null =
      row.event_type === 'payment_recorded' || row.event_type === 'payment_updated' || row.event_type === 'payment_deleted'
        ? row.event_type
        : null

    const inv =
      paymentEvent && typeof row.metadata.invoice_number === 'string' ? row.metadata.invoice_number : '—'
    const amtRaw = paymentEvent ? row.metadata.amount_applied : null
    const amt = typeof amtRaw === 'number' ? amtRaw : Number(amtRaw)
    const payCcy =
      paymentEvent && typeof row.metadata.invoice_currency === 'string' ? row.metadata.invoice_currency : currencyCode
    const method = paymentEvent && typeof row.metadata.method === 'string' ? row.metadata.method : '—'

    const statusKey = STATUS_EVENT_KEY[row.event_type] ?? null

    const isShipped = row.event_type === 'order_shipped'
    const isReassign = row.event_type === 'delivery_person_reassigned'
    const dpName =
      typeof row.metadata.delivery_person_name === 'string' ? row.metadata.delivery_person_name : null
    const dpPhone =
      typeof row.metadata.delivery_person_phone === 'string' ? row.metadata.delivery_person_phone : null

    const isInvoiceCreated = row.event_type === 'invoice_created'
    const invoiceNumber =
      typeof row.metadata.invoice_number === 'string' ? row.metadata.invoice_number : null

    return (
      <li key={row.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-500">
          <span>{fmt(row.created_at)}</span>
          <span>{t('by', { name: row.actor_label })}</span>
        </div>
        {row.event_type === 'order_lines_modified' ? (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-medium text-slate-800">{t('linesModified')}</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
              {lines.map((ln, i) => (
                <li key={i}>
                  <span className="font-medium">{ln.product_label}</span>:{' '}
                  {t('qtyFromTo', { from: ln.old_quantity, to: ln.new_quantity })},{' '}
                  {t('priceFromTo', {
                    from: formatMoney(ln.old_unit_price, currencyCode),
                    to: formatMoney(ln.new_unit_price, currencyCode),
                  })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {paymentEvent ? (
          <p className="mt-2 break-words text-sm text-slate-700">
            {t(paymentAuditKey(paymentEvent), {
              invoice: inv,
              amount: formatMoney(Number.isFinite(amt) ? amt : 0, payCcy),
              method,
            })}
          </p>
        ) : null}
        {statusKey ? <p className="mt-2 text-sm text-slate-700">{t(statusKey)}</p> : null}
        {isShipped ? (
          <p className="mt-2 text-sm text-slate-700">
            {t('orderShipped', { name: dpName ?? '—', phone: dpPhone ?? '—' })}
          </p>
        ) : null}
        {isReassign ? (
          <p className="mt-2 text-sm text-slate-700">
            {t('deliveryReassigned', { name: dpName ?? '—', phone: dpPhone ?? '—' })}
          </p>
        ) : null}
        {isInvoiceCreated ? (
          <p className="mt-2 text-sm text-slate-700">
            {t('invoiceCreated', { invoice: invoiceNumber ?? '—' })}
          </p>
        ) : null}
        {row.event_type !== 'order_lines_modified' &&
        !paymentEvent &&
        !statusKey &&
        !isShipped &&
        !isReassign &&
        !isInvoiceCreated ? (
          <p className="mt-1 text-sm text-slate-700">{row.event_type}</p>
        ) : null}
      </li>
    )
  })
}
