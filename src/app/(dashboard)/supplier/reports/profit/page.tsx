import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ProfitChart } from '@/components/charts/profit-chart'
import { ProductProfitTable } from '@/components/charts/product-profit-table'
import { LowMarginAlerts } from '@/components/charts/low-margin-alerts'
import { getSupplierProfitReport } from '@/lib/data/profit-analytics'
import { formatCurrency } from '@/lib/utils'

export default async function SupplierProfitReportPage() {
  const t = await getTranslations('ProfitPage')
  const res = await getSupplierProfitReport()

  if ('error' in res) {
    return <p className="text-sm text-red-600">{t('loadError', { details: res.error })}</p>
  }

  const { data: d } = res
  const ccy = d.currencyCode

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
          <p className="mt-2 text-xs text-slate-500">{t('snapshotHint')}</p>
        </div>
        <Link href="/supplier/reports" className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline">
          {t('backToReports')}
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('cardGrossRevenue')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(d.summary.grossRevenue, ccy)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('cardTotalCost')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-rose-800">{formatCurrency(d.summary.totalCost, ccy)}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-emerald-900">{t('cardGrossProfit')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-950">{formatCurrency(d.summary.grossProfit, ccy)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('cardOperatingExpenses')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-900">{formatCurrency(d.summary.totalOperatingExpenses, ccy)}</p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-indigo-900">{t('cardNetProfit')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-indigo-950">{formatCurrency(d.summary.netProfit, ccy)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('cardMarginLabel')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{d.summary.profitMarginPct.toFixed(1)}%</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{t('sectionMonthly')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('sectionMonthlyHint')}</p>
        <div className="mt-4">
          <ProfitChart data={d.monthly} currency={ccy} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{t('sectionProducts')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('sectionProductsHint')}</p>
        <div className="mt-4">
          <ProductProfitTable rows={d.products} currency={ccy} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{t('sectionLowMargin')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('sectionLowMarginHint')}</p>
        <div className="mt-4">
          <LowMarginAlerts rows={d.lowMargin} currency={ccy} />
        </div>
      </section>
    </div>
  )
}
