'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslations } from 'next-intl'
import type { ProductProfitRow } from '@/lib/data/profit-analytics'

type Tab = 'revenue' | 'profit' | 'margin'

type Props = {
  rows: ProductProfitRow[]
  currency: string
}

function marginBadgeClass(pct: number) {
  if (pct >= 40) return 'bg-emerald-100 text-emerald-800'
  if (pct >= 20) return 'bg-green-100 text-green-700'
  if (pct >= 10) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

function fmtMoney(v: number, currency: string) {
  return new Intl.NumberFormat('ar', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v)
}

export function ProductProfitTable({ rows, currency }: Props) {
  const t = useTranslations('ProfitPage.productTable')
  const [tab, setTab] = useState<Tab>('profit')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(
      (r) =>
        r.productName.toLowerCase().includes(needle) ||
        r.variationName.toLowerCase().includes(needle) ||
        (r.sku && r.sku.toLowerCase().includes(needle)),
    )
  }, [rows, q])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    if (tab === 'revenue') copy.sort((a, b) => b.totalRevenue - a.totalRevenue)
    else if (tab === 'profit') copy.sort((a, b) => b.totalProfit - a.totalProfit)
    else copy.sort((a, b) => b.profitMarginPct - a.profitMarginPct)
    return copy
  }, [filtered, tab])

  const top10 = useMemo(() => sorted.slice(0, 10), [sorted])

  const barData = useMemo(
    () =>
      top10.map((r) => ({
        name: `${r.productName.slice(0, 14)}${r.productName.length > 14 ? '…' : ''}`,
        value: tab === 'revenue' ? r.totalRevenue : tab === 'profit' ? r.totalProfit : r.profitMarginPct,
      })),
    [top10, tab],
  )

  const exportCsv = () => {
    const headers = [
      t('colProduct'),
      t('colVariation'),
      t('colSku'),
      t('colUnits'),
      t('colRevenue'),
      t('colCost'),
      t('colProfit'),
      t('colMargin'),
    ]
    const lines = sorted.map((r) =>
      [r.productName, r.variationName, r.sku ?? '', r.unitsSold, r.totalRevenue, r.totalCost, r.totalProfit, r.profitMarginPct]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(','),
    )
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product-profit.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['profit', 'revenue', 'margin'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t(`tab_${key}`)}
          </button>
        ))}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="ms-auto min-w-[160px] rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          {t('exportCsv')}
        </button>
      </div>

      {top10.length > 0 && (
        <div className="h-[240px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={barData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                className="text-slate-600"
                tickFormatter={(v) =>
                  tab === 'margin' ? `${Math.round(Number(v))}%` : fmtMoney(Number(v), currency)
                }
              />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} className="text-slate-600" />
              <Tooltip
                formatter={(v) => {
                  const n = typeof v === 'number' ? v : Number(v)
                  if (tab === 'margin') return [`${Number.isFinite(n) ? n.toFixed(1) : 0}%`, t('colMargin')]
                  return [fmtMoney(Number.isFinite(n) ? n : 0, currency), tab === 'revenue' ? t('colRevenue') : t('colProfit')]
                }}
              />
              <Bar dataKey="value" fill="#0f172a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-start font-medium text-slate-700">{t('colProduct')}</th>
              <th className="px-3 py-2 text-start font-medium text-slate-700">{t('colVariation')}</th>
              <th className="px-3 py-2 text-start font-medium text-slate-700">{t('colSku')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colUnits')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colRevenue')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colCost')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colProfit')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colMargin')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  {t('empty')}
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={`${r.productId}-${r.variationId}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-900">
                    <Link
                      href={`/supplier/products/${r.productId}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {r.productName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.variationName}</td>
                  <td className="px-3 py-2 text-slate-600">{r.sku ?? '—'}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{r.unitsSold}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.totalRevenue, currency)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{fmtMoney(r.totalCost, currency)}</td>
                  <td className="px-3 py-2 text-end font-medium tabular-nums text-emerald-800">
                    {fmtMoney(r.totalProfit, currency)}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${marginBadgeClass(r.profitMarginPct)}`}>
                      {r.profitMarginPct.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
