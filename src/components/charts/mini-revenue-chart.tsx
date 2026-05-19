'use client'

import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useTranslations } from 'next-intl'
import type { MiniRevenuePt } from '@/lib/data/supplier-stats'

type Props = {
  data: MiniRevenuePt[]
  currency?: string
}

function fmtMoney(v: number, currency: string) {
  return new Intl.NumberFormat('ar', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}

export function MiniRevenueChart({ data, currency = 'USD' }: Props) {
  const t = useTranslations('DashboardSupplier')

  return (
    <div className="h-[200px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradInvoiced" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradCollected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-slate-500" />
          <YAxis tick={{ fontSize: 10 }} className="text-slate-500" width={60} tickFormatter={(v) => fmtMoney(Number(v), currency)} />
          <Tooltip
            formatter={(v, name) => [
              fmtMoney(Number(v ?? 0), currency),
              name === 'invoiced' ? t('totalInvoiced') : t('totalCollected'),
            ]}
            contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
          />
          <Area
            type="monotone"
            dataKey="invoiced"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#gradInvoiced)"
          />
          <Area
            type="monotone"
            dataKey="collected"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gradCollected)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
