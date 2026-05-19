import { getLocale, getTranslations } from 'next-intl/server'
import type { AuditLogRow } from '@/lib/data/audit-log'
import { formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import type { OrderStatus } from '@/lib/validations/order'
import { OrderTimeline } from '@/components/orders/order-timeline'
import { OrderAuditEntries } from '@/components/orders/order-audit-entries'

type Props = {
  status: OrderStatus
  createdAt: string
  audit: AuditLogRow[]
  currencyCode: string
}

export async function OrderActivitySection({ status, createdAt, audit, currencyCode }: Props) {
  const t = await getTranslations('OrderActivity')
  const locale = normalizeAppLocale(await getLocale())
  const fmt = (d: string) => formatDateTimeShort(d, locale)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{t('title')}</h2>
      <p className="mt-1 text-xs text-slate-600">{t('lead')}</p>
      <div className="mt-3">
        <OrderTimeline status={status} />
      </div>
      <ul className="mt-4 space-y-4">
        <li className="border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-500">
            <span>{fmt(createdAt)}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700">{t('orderPlaced')}</p>
        </li>
        <OrderAuditEntries audit={audit} currencyCode={currencyCode} sortOrder="asc" />
      </ul>
    </section>
  )
}
