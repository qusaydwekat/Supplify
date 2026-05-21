import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { BalanceOverview, RevenueChart, TopProductsChart } from '@/components/charts/lazy-charts'
import { getSupplierReportAnalytics } from '@/lib/data/report-analytics'
import { getSupplierReportStats } from '@/lib/data/supplier-stats'
import { formatDateDayMonthYear, normalizeAppLocale } from '@/lib/format-datetime'
import { formatCurrency } from '@/lib/utils'
import type { OrderStatus } from '@/lib/validations/order'

function ageBucketClass(bucket: string) {
  switch (bucket) {
    case 'current':
      return 'text-slate-700'
    case '30_60':
      return 'text-amber-800'
    case '60_90':
      return 'text-orange-800'
    case '90_plus':
      return 'text-red-700'
    default:
      return 'text-slate-700'
  }
}

export default async function SupplierReportsPage() {
  const t = await getTranslations('ReportsPage')
  const tOrder = await getTranslations('OrderStatus')
  const tInv = await getTranslations('InvoiceStatus')
  const locale = normalizeAppLocale(await getLocale())
  const [statsRes, analyticsRes] = await Promise.all([getSupplierReportStats(), getSupplierReportAnalytics()])

  if ('error' in statsRes) {
    return <p className="text-sm text-red-600">{t('loadError', { details: statsRes.error })}</p>
  }
  if ('error' in analyticsRes) {
    return <p className="text-sm text-red-600">{t('loadError', { details: analyticsRes.error })}</p>
  }

  const s = statsRes.stats
  const a = analyticsRes
  const ccy = s.currencyCode
  const statusOrder = [
    'pending',
    'accepted',
    'modified',
    'preparing',
    'shipped',
    'delivered',
    'rejected',
    'cancelled',
  ] as const satisfies readonly OrderStatus[]

  const outstandingRows = a.outstandingInvoices.filter((inv) => inv.outstanding > 0.005)

  const ageLabel = (bucket: string) => {
    switch (bucket) {
      case 'current':
        return t('ageCurrent')
      case '30_60':
        return t('age30_60')
      case '60_90':
        return t('age60_90')
      case '90_plus':
        return t('age90_plus')
      default:
        return bucket
    }
  }

  const invoiceStatusLabel = (status: string) => {
    if (status === 'issued' || status === 'paid' || status === 'partial' || status === 'overdue') {
      return tInv(status)
    }
    return status
  }

  const fmtDate = (d: string | Date | null | undefined) => formatDateDayMonthYear(d ?? null, locale)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
        </div>
        <Link
          href="/supplier/reports/profit"
          className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
        >
          {t('linkProfitAnalysis')}
        </Link>
      </div>

      <BalanceOverview
        totalInvoiced={s.totalInvoiced}
        totalCollected={s.totalCollected}
        outstanding={s.outstandingBalance}
        currency={ccy}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('outstanding')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(s.outstandingBalance, ccy)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('invoicedLedger')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(s.totalInvoiced, ccy)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('collected')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(s.totalCollected, ccy)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('ordersThisMonth')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{a.ordersThisMonth}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('activeRetailers')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{a.activeRetailers}</p>
          <p className="mt-1 text-[11px] text-slate-500">{t('activeRetailersHint')}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-amber-900">{t('lowStockUnits')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-950">{s.lowStockVariations}</p>
          <Link href="/supplier/products" className="mt-2 inline-block text-xs text-amber-900 underline">
            {t('reviewProducts')}
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{t('monthlyRevenueTitle')}</h2>
        <p className="mt-1 text-xs text-slate-500">{t('monthlyRevenueHint')}</p>
        <div className="mt-4">
          <RevenueChart data={a.monthly} currency={ccy} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">{t('topProductsChartTitle')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('topProductsChartHint')}</p>
          <div className="mt-4">
            <TopProductsChart rows={a.topProducts} currency={ccy} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{t('topProductsTableTitle')}</h2>
          </div>
          {a.topProducts.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">{t('noSalesData')}</p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-start text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">{t('colProduct')}</th>
                    <th className="px-4 py-2">{t('colVariation')}</th>
                    <th className="px-4 py-2 text-end">{t('qtySold')}</th>
                    <th className="px-4 py-2 text-end">{t('revenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {a.topProducts.slice(0, 12).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-900">{row.productName}</td>
                      <td className="px-4 py-2 text-slate-600">{row.variationName ?? '—'}</td>
                      <td className="px-4 py-2 text-end tabular-nums text-slate-900">{row.quantitySold}</td>
                      <td className="px-4 py-2 text-end font-medium tabular-nums text-slate-900">
                        {formatCurrency(row.revenue, ccy)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{t('topRetailersTitle')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('topRetailersHint')}</p>
        </div>
        {a.topRetailers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">{t('noRetailerActivity')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-start text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">{t('colRetailer')}</th>
                  <th className="px-4 py-2">{t('colCity')}</th>
                  <th className="px-4 py-2 text-end">{t('colOrders')}</th>
                  <th className="px-4 py-2 text-end">{t('colInvoiced')}</th>
                  <th className="px-4 py-2 text-end">{t('colPaid')}</th>
                  <th className="px-4 py-2 text-end">{t('colOutstandingTable')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {a.topRetailers.slice(0, 25).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{row.retailerLabel}</td>
                    <td className="px-4 py-2 text-slate-600">{row.city ?? '—'}</td>
                    <td className="px-4 py-2 text-end tabular-nums text-slate-900">{row.orderCount}</td>
                    <td className="px-4 py-2 text-end tabular-nums text-slate-900">{formatCurrency(row.totalInvoiced, ccy)}</td>
                    <td className="px-4 py-2 text-end tabular-nums text-emerald-700">{formatCurrency(row.totalPaid, ccy)}</td>
                    <td className="px-4 py-2 text-end font-semibold tabular-nums text-slate-900">
                      {formatCurrency(row.outstanding, ccy)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{t('outstandingInvTitle')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('outstandingInvHint')}</p>
        </div>
        {outstandingRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">{t('noOpenInv')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-start text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">{t('colInvoice')}</th>
                  <th className="px-4 py-2">{t('colRetailerInv')}</th>
                  <th className="px-4 py-2">{t('colIssued')}</th>
                  <th className="px-4 py-2">{t('colDue')}</th>
                  <th className="px-4 py-2 text-end">{t('colTotal')}</th>
                  <th className="px-4 py-2 text-end">{t('colPaidInv')}</th>
                  <th className="px-4 py-2 text-end">{t('colOutstandingInv')}</th>
                  <th className="px-4 py-2">{t('colStatus')}</th>
                  <th className="px-4 py-2">{t('colAge')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outstandingRows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/supplier/invoices/${inv.id}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-800">{inv.retailerLabel}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDate(inv.issued_at)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">{fmtDate(inv.due_date)}</td>
                    <td className="px-4 py-2 text-end tabular-nums">{formatCurrency(inv.total, ccy)}</td>
                    <td className="px-4 py-2 text-end tabular-nums text-emerald-700">{formatCurrency(inv.paid, ccy)}</td>
                    <td className="px-4 py-2 text-end font-medium tabular-nums">{formatCurrency(inv.outstanding, ccy)}</td>
                    <td className="px-4 py-2 capitalize text-slate-700">{invoiceStatusLabel(inv.status)}</td>
                    <td className={`px-4 py-2 text-xs font-medium ${ageBucketClass(inv.ageBucket)}`}>
                      {ageLabel(inv.ageBucket)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{t('ordersByStatusTitle')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-start text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">{t('colStatusTable')}</th>
                <th className="px-4 py-2 text-end">{t('colCount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statusOrder.map((st) => (
                <tr key={st} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-800">{tOrder(st)}</td>
                  <td className="px-4 py-2 text-end tabular-nums text-slate-900">{s.ordersByStatus[st] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-4 py-3">
          <Link href="/supplier/orders" className="text-sm font-medium text-slate-900 underline-offset-2 hover:underline">
            {t('openOrdersLink')}
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{t('receivablesByRetailerTitle')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('receivablesByRetailerHint')}</p>
        </div>
        {s.retailerRows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">{t('noNonZero')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-start text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">{t('colRetailer')}</th>
                  <th className="px-4 py-2 text-end">{t('colBalance')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.retailerRows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-900">{row.retailerLabel}</td>
                    <td className="px-4 py-2 text-end font-medium tabular-nums text-slate-900">{formatCurrency(row.balance, ccy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
