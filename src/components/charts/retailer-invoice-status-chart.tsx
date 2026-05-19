'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useTranslations } from 'next-intl'

type Props = {
  counts: { issued: number; partial: number; overdue: number; paid: number }
}

const COLORS: Record<string, string> = {
  issued: '#3b82f6',
  partial: '#f59e0b',
  overdue: '#ef4444',
  paid: '#10b981',
}

export function RetailerInvoiceStatusChart({ counts }: Props) {
  const t = useTranslations('InvoiceStatus')

  const data = [
    { key: 'issued', name: t('issued'), value: counts.issued, fill: COLORS.issued },
    { key: 'partial', name: t('partial'), value: counts.partial, fill: COLORS.partial },
    { key: 'overdue', name: t('overdue'), value: counts.overdue, fill: COLORS.overdue },
    { key: 'paid', name: t('paid'), value: counts.paid, fill: COLORS.paid },
  ].filter((d) => d.value > 0)

  if (!data.length) return null

  return (
    <div className="h-[210px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
            {data.map((d, idx) => (
              <Cell key={idx} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [Number(v ?? 0), '']} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

