import { getTranslations } from 'next-intl/server'
import type { AuditLogRow } from '@/lib/data/audit-log'
import { OrderAuditEntries } from '@/components/orders/order-audit-entries'

type Props = {
  audit: AuditLogRow[]
  currencyCode: string
}

export async function OrderAuditBlock({ audit, currencyCode }: Props) {
  const t = await getTranslations('OrderAudit')
  if (!audit.length) return null

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{t('title')}</h2>
      <p className="mt-1 text-xs text-slate-600">{t('lead')}</p>
      <ul className="mt-4 space-y-4">
        <OrderAuditEntries audit={audit} currencyCode={currencyCode} sortOrder="desc" />
      </ul>
    </section>
  )
}
