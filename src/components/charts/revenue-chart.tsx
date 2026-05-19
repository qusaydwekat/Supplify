'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslations } from 'next-intl'
import type { MonthlyRevenuePoint } from '@/lib/data/report-analytics'

type Props = {
  data: MonthlyRevenuePoint[]
  /** ISO 4217 code (e.g. supplier store currency). */
  currency?: string
}

function fmtMoney(v: number, currency: string) {
  return new Intl.NumberFormat('ar', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}

export function RevenueChart({ data, currency = 'USD' }: Props) {
  const t = useTranslations('Charts')
  const chartData = data.map((d) => ({
    month: d.label,
    invoiced: d.invoiced,
    collected: d.collected,
  }))

  return (
    <div className="h-[320px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-slate-600" />
          <YAxis tick={{ fontSize: 11 }} className="text-slate-600" tickFormatter={(v) => fmtMoney(Number(v), currency)} />
          <Tooltip
            formatter={(v) => {
              const n = typeof v === 'number' ? v : Number(v)
              return [fmtMoney(Number.isFinite(n) ? n : 0, currency), '']
            }}
          />
          <Legend />
          <Bar name={t('invoiced')} dataKey="invoiced" fill="#b45309" radius={[4, 4, 0, 0]} />
          <Bar name={t('collected')} dataKey="collected" fill="#047857" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
