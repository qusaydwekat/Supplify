'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useTranslations } from 'next-intl'

type Props = {
  data: { status: string; count: number }[]
}

const COLORS: Record<string, string> = {
  pending: '#f59e0b',
  accepted: '#3b82f6',
  modified: '#8b5cf6',
  preparing: '#06b6d4',
  shipped: '#6366f1',
  delivered: '#10b981',
  rejected: '#ef4444',
  cancelled: '#94a3b8',
}

export function OrderStatusChart({ data }: Props) {
  const t = useTranslations('OrderStatus')
  const filtered = data.filter((d) => d.count > 0)

  if (!filtered.length) return null

  const chartData = filtered.map((d) => ({
    name: t(d.status),
    value: d.count,
    fill: COLORS[d.status] ?? '#94a3b8',
  }))

  return (
    <div className="h-[220px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [Number(v ?? 0), '']} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
