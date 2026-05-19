'use client'

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslations } from 'next-intl'
import type { TopProductRow } from '@/lib/data/report-analytics'

type Props = {
  rows: TopProductRow[]
  /** ISO 4217 code (e.g. supplier store currency). */
  currency?: string
}

function fmtMoney(v: number, currency: string) {
  return new Intl.NumberFormat('ar', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}

export function TopProductsChart({ rows, currency = 'USD' }: Props) {
  const t = useTranslations('Charts')
  const slice = rows.slice(0, 8).map((r) => ({
    name: `${r.productName}${r.variationName ? ` — ${r.variationName}` : ''}`.slice(0, 42),
    revenue: r.revenue,
  }))

  if (!slice.length) {
    return <p className="text-sm text-slate-500">{t('topProductsEmpty')}</p>
  }

  return (
    <div className="h-[280px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={slice} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} className="text-slate-600" tickFormatter={(v) => fmtMoney(Number(v), currency)} />
          <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} className="text-slate-600" />
          <Tooltip
            formatter={(v) => {
              const n = typeof v === 'number' ? v : Number(v)
              return [fmtMoney(Number.isFinite(n) ? n : 0, currency), t('revenue')]
            }}
          />
          <Bar dataKey="revenue" fill="#0f172a" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
