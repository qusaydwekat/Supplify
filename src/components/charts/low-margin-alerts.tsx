'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { LowMarginVariationRow } from '@/lib/data/profit-analytics'

type Props = {
  rows: LowMarginVariationRow[]
  currency: string
}

function fmtMoney(v: number, currency: string) {
  return new Intl.NumberFormat('ar', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v)
}

export function LowMarginAlerts({ rows, currency }: Props) {
  const t = useTranslations('ProfitPage.lowMargin')

  if (!rows.length) {
    return <p className="text-sm text-slate-500">{t('empty')}</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-amber-200 bg-amber-50/40">
      <table className="min-w-full divide-y divide-amber-200 text-sm">
        <thead className="bg-amber-100/80">
          <tr>
            <th className="px-3 py-2 text-start font-medium text-amber-950">{t('colProduct')}</th>
            <th className="px-3 py-2 text-start font-medium text-amber-950">{t('colVariation')}</th>
            <th className="px-3 py-2 text-end font-medium text-amber-950">{t('colCost')}</th>
            <th className="px-3 py-2 text-end font-medium text-amber-950">{t('colPrice')}</th>
            <th className="px-3 py-2 text-end font-medium text-amber-950">{t('colMargin')}</th>
            <th className="px-3 py-2 text-end font-medium text-amber-950">{t('colAction')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-100 bg-white">
          {rows.map((r) => (
            <tr key={r.variationId} className="hover:bg-amber-50/80">
              <td className="px-3 py-2 text-slate-900">{r.productName}</td>
              <td className="px-3 py-2 text-slate-700">{r.variationName}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.costPrice, currency)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.sellingPrice, currency)}</td>
              <td className="px-3 py-2 text-end font-semibold tabular-nums text-red-800">{r.currentMarginPct.toFixed(1)}%</td>
              <td className="px-3 py-2 text-end">
                <Link
                  href={`/supplier/products/${r.productId}`}
                  className="text-sm font-medium text-amber-950 underline-offset-2 hover:underline"
                >
                  {t('editPricing')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
