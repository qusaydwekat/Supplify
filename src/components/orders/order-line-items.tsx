import { getTranslations } from 'next-intl/server'
import { formatMoney } from '@/lib/format-money'
import type { OrderItemRow } from '@/lib/data/orders'

export async function OrderLineItems({
  items,
  currencyCode = 'USD',
}: {
  items: OrderItemRow[]
  currencyCode?: string
}) {
  const t = await getTranslations('LineItemsTable')
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-start text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">{t('product')}</th>
            <th className="px-4 py-2 text-end">{t('qty')}</th>
            <th className="px-4 py-2 text-end">{t('unit')}</th>
            <th className="px-4 py-2 text-end">{t('lineTotal')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((i) => (
            <tr key={i.id}>
              <td className="px-4 py-2 text-slate-900">
                {i.product_name}
                {i.variation_name ? <span className="text-slate-500"> — {i.variation_name}</span> : null}
              </td>
              <td className="px-4 py-2 text-end tabular-nums">{i.quantity}</td>
              <td className="px-4 py-2 text-end tabular-nums text-slate-600">{formatMoney(i.unit_price, currencyCode)}</td>
              <td className="px-4 py-2 text-end font-medium tabular-nums">{formatMoney(i.total_price, currencyCode)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
