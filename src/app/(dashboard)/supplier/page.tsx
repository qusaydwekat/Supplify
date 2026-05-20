import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  ShoppingCart,
  Package,
  FileText,
  CircleDollarSign,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Star,
  Clock,
  Truck,
  CheckCircle2,
  BarChart3,
  Plus,
  FileWarning,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getSupplierDashboardStats } from '@/lib/data/supplier-stats'
import { getSupplierCatalogAlertStats } from '@/lib/data/catalog-alerts'
import { getSupplierCollectionAlerts } from '@/lib/data/collection-alerts'
import { formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { MiniRevenueChart } from '@/components/charts/mini-revenue-chart'
import { OrderStatusChart } from '@/components/charts/order-status-chart'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import type { OrderStatus } from '@/lib/validations/order'
import { FxRatesWidget } from '@/components/fx/fx-rates-widget'

export default async function SupplierDashboardHome() {
  const t = await getTranslations('DashboardSupplier')
  const tErr = await getTranslations('SupplierDashboard')
  const locale = normalizeAppLocale(await getLocale())
  const res = await getSupplierDashboardStats()
  if ('error' in res) {
    return <p className="text-sm text-red-600">{tErr('error')}</p>
  }
  const s = res.stats
  const ccy = s.currencyCode
  const alertsRes = await getSupplierCollectionAlerts()
  const catalogAlerts = await getSupplierCatalogAlertStats()
  const collection = 'error' in alertsRes ? null : alertsRes
  const catalog = catalogAlerts.stats
  const showCatalogAlerts = catalog.lowStockSkus > 0 || catalog.draftProducts > 0
  const showCollection = Boolean(
    collection && (collection.overdueCount > 0 || collection.dueSoonCount > 0),
  )
  const showDeliveredUninvoiced = s.deliveredUninvoicedCount > 0

  const collectionRate = s.totalInvoiced > 0 ? Math.round((s.totalCollected / s.totalInvoiced) * 100) : 0

  const statusData = Object.entries(s.ordersByStatus ?? {})
    .map(([status, count]) => ({ status, count: count ?? 0 }))
    .filter((d) => d.count > 0)

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/supplier/invoices/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('linkNewInvoice')}
          </Link>
          <Link
            href="/supplier/reports"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
          >
            <BarChart3 className="h-4 w-4" />
            {t('linkReports')}
          </Link>
        </div>
      </div>

      {/* Catalog / inventory alerts */}
      {showCatalogAlerts && (
        <div className="flex items-start gap-3 rounded-xl border border-sky-200/80 bg-sky-50/80 p-4 shadow-sm">
          <Package className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sky-950">{t('catalogAlertsTitle')}</p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-sky-900">
              {catalog.lowStockSkus > 0 && (
                <li>{t('catalogAlertLowStock', { count: catalog.lowStockSkus })}</li>
              )}
              {catalog.draftProducts > 0 && (
                <li>{t('catalogAlertDrafts', { count: catalog.draftProducts })}</li>
              )}
            </ul>
            <div className="mt-2 flex flex-wrap gap-3 text-sm font-medium">
              <Link href="/supplier/products?lowStock=1" className="text-sky-900 underline-offset-4 hover:underline">
                {t('catalogAlertViewLowStock')}
              </Link>
              <Link href="/supplier/inventory/receive" className="text-sky-900 underline-offset-4 hover:underline">
                {t('catalogAlertReceive')}
              </Link>
              <Link href="/supplier/products/performance" className="text-sky-900 underline-offset-4 hover:underline">
                {t('catalogAlertPerformance')}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Collection Alert */}
      {showCollection && collection && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-amber-950">{t('collectionHint')}</p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-amber-900">
              {collection.overdueCount > 0 && <li>{t('collectionOverdue', { count: collection.overdueCount })}</li>}
              {collection.dueSoonCount > 0 && <li>{t('collectionDueSoon', { count: collection.dueSoonCount })}</li>}
            </ul>
            <Link href="/supplier/invoices" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-900 underline-offset-4 hover:underline">
              {t('linkInvoicesCollection')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Delivered but not invoiced */}
      {showDeliveredUninvoiced && (
        <div className="flex items-start gap-3 rounded-xl border border-indigo-200/80 bg-indigo-50/80 p-4 shadow-sm">
          <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-indigo-950">{t('invoiceGapTitle')}</p>
            <p className="mt-1 text-sm text-indigo-900">
              {s.deliveredUninvoicedCount === 1 ? t('invoiceGapBodyOne') : t('invoiceGapBodyOther', { count: s.deliveredUninvoicedCount })}
            </p>
            <Link
              href="/supplier/invoices/new"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-900 underline-offset-4 hover:underline"
            >
              {t('linkInvoiceGap')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* KPI Cards — top row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/supplier/orders?status=pending"
          className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-amber-100 p-2.5">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums text-foreground">{s.pendingOrders}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{t('pendingOrders')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">{t('pendingOrdersHint')}</p>
        </Link>

        <Link
          href="/supplier/orders"
          className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <Truck className="h-5 w-5 text-blue-700" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums text-foreground">{s.preparingOrders}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{t('inFulfilment')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">{t('inFulfilmentHint')}</p>
        </Link>

        <Link
          href="/supplier/products?lowStock=1"
          className="group relative overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-sm transition hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-amber-200/80 p-2.5">
              <Package className="h-5 w-5 text-amber-800" />
            </div>
            <ArrowRight className="h-4 w-4 text-amber-700 opacity-0 transition group-hover:opacity-100" />
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums text-amber-950">{s.lowStockVariations}</p>
          <p className="mt-1 text-sm font-medium text-amber-900">{t('lowStock')}</p>
          <p className="mt-0.5 text-xs text-amber-800/70">{t('lowStockHint')}</p>
        </Link>

        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-emerald-100 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            </div>
            {s.avgRating !== null && (
              <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                <span className="text-xs font-semibold text-amber-900">{s.avgRating.toFixed(1)}</span>
                <span className="text-xs text-amber-700">({s.reviewCount})</span>
              </div>
            )}
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums text-foreground">{s.deliveredOrders}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{t('deliveredOrders')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">{t('ofTotal', { total: s.totalOrders })}</p>
        </div>
      </div>

      {/* Financial Summary + Revenue Trend */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Financial cards */}
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-100 p-2.5">
                <FileText className="h-5 w-5 text-indigo-700" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('totalInvoiced')}</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(s.totalInvoiced, ccy)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2.5">
                <CircleDollarSign className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('totalCollected')}</p>
                <p className="text-xl font-bold tabular-nums text-emerald-700">{formatCurrency(s.totalCollected, ccy)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-rose-100 p-2.5">
                <TrendingUp className="h-5 w-5 text-rose-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('outstanding')}</p>
                <p className="text-xl font-bold tabular-nums text-foreground">{formatCurrency(s.outstandingBalance, ccy)}</p>
              </div>
            </div>
            {/* Collection Rate Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('collectionRate')}</span>
                <span className="font-semibold tabular-nums text-foreground">{collectionRate}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, collectionRate)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Revenue trend chart */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('revenueTrend')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('revenueTrendHint')}</p>
            </div>
            <Link href="/supplier/reports" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
              {t('viewAll')}
            </Link>
          </div>
          <div className="mt-4">
            <MiniRevenueChart data={s.monthlyMini} currency={ccy} />
          </div>
        </div>
      </div>

      {/* Order Status Chart + Recent Orders */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Order status donut */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">{t('orderBreakdown')}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('orderBreakdownHint')}</p>
          {statusData.length > 0 ? (
            <OrderStatusChart data={statusData} />
          ) : (
            <p className="mt-8 text-center text-sm text-muted-foreground">{t('noOrders')}</p>
          )}
        </div>

        {/* Recent orders */}
        <div className="rounded-xl border border-border bg-card shadow-sm lg:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">{t('recentOrders')}</h2>
            <Link href="/supplier/orders" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
              {t('viewAll')}
            </Link>
          </div>
          {s.recentOrders.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t('noOrders')}</p>
          ) : (
            <div className="divide-y divide-border/80">
              {s.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/supplier/orders/${order.id}`}
                  className="flex items-center justify-between px-5 py-3 transition hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{order.retailerName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTimeShort(order.createdAt, locale)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(order.total, ccy)}
                    </span>
                    <OrderStatusBadge status={order.status as OrderStatus} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <FxRatesWidget />

      {/* Quick links footer */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/supplier/orders"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md"
        >
          <ShoppingCart className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('manageOrders')}</p>
            <p className="text-xs text-muted-foreground">{t('manageOrdersHint')}</p>
          </div>
        </Link>
        <Link
          href="/supplier/payments"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md"
        >
          <CircleDollarSign className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('linkPayments')}</p>
            <p className="text-xs text-muted-foreground">{t('paymentLogHint')}</p>
          </div>
        </Link>
        <Link
          href="/supplier/ledger"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md"
        >
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('ledger')}</p>
            <p className="text-xs text-muted-foreground">{t('ledgerHint')}</p>
          </div>
        </Link>
        <Link
          href="/supplier/products"
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md"
        >
          <Package className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('products')}</p>
            <p className="text-xs text-muted-foreground">{t('productsHint')}</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
