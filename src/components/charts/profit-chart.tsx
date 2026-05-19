'use client'

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslations } from 'next-intl'
import type { MonthlyProfitPoint } from '@/lib/data/profit-analytics'

type Props = {
  data: MonthlyProfitPoint[]
  currency?: string
}

function fmtMoney(v: number, currency: string) {
  return new Intl.NumberFormat('ar', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}

export function ProfitChart({ data, currency = 'USD' }: Props) {
  const t = useTranslations('ProfitPage.chart')

  if (!data.length) {
    return <p className="text-sm text-slate-500">{t('empty')}</p>
  }

  return (
    <div className="h-[360px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-slate-600" />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11 }}
            className="text-slate-600"
            tickFormatter={(v) => fmtMoney(Number(v), currency)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
            className="text-slate-600"
            domain={[0, 'auto']}
            tickFormatter={(v) => `${Math.round(Number(v))}%`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="mb-1 font-medium text-slate-800">{label}</p>
                  {payload.map((p) => {
                    const n = typeof p.value === 'number' ? p.value : Number(p.value)
                    const isPct = p.dataKey === 'profitMarginPct'
                    return (
                      <p key={String(p.dataKey)} className="tabular-nums text-slate-700">
                        {p.name}: {isPct ? `${Number.isFinite(n) ? n.toFixed(1) : 0}%` : fmtMoney(Number.isFinite(n) ? n : 0, currency)}
                      </p>
                    )
                  })}
                </div>
              )
            }}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="revenue" name={t('revenue')} fill="#334155" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="cost" name={t('cost')} fill="#f43f5e" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="left" dataKey="profit" name={t('profit')} fill="#047857" radius={[4, 4, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="profitMarginPct"
            name={t('marginPct')}
            stroke="#7c3aed"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
