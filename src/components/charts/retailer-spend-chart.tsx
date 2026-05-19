'use client'

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslations } from 'next-intl'

type Point = { label: string; invoiced: number; paid: number }

type Props = {
  data: Point[]
  currency?: string
}

function fmtMoney(v: number, currency: string) {
  return new Intl.NumberFormat('ar', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}

export function RetailerSpendChart({ data, currency = 'USD' }: Props) {
  const t = useTranslations('DashboardRetailer')

  return (
    <div className="h-[210px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradInvoicedRetailer" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradPaidRetailer" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-slate-500" />
          <YAxis
            tick={{ fontSize: 10 }}
            className="text-slate-500"
            width={60}
            tickFormatter={(v) => fmtMoney(Number(v ?? 0), currency)}
          />
          <Tooltip
            formatter={(v, name) => [
              fmtMoney(Number(v ?? 0), currency),
              name === 'invoiced' ? t('invoiced') : t('paid'),
            ]}
            contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
          />
          <Area type="monotone" dataKey="invoiced" stroke="#f97316" strokeWidth={2} fill="url(#gradInvoicedRetailer)" />
          <Area type="monotone" dataKey="paid" stroke="#10b981" strokeWidth={2} fill="url(#gradPaidRetailer)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

