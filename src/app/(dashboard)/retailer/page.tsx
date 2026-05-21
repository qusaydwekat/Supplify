import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getRetailerDashboardStats } from '@/lib/data/retailer-stats'
import { formatCurrency } from '@/lib/utils'
import { getLocale } from 'next-intl/server'
import { normalizeAppLocale, formatDateTimeShort } from '@/lib/format-datetime'
import { RetailerSpendChart, RetailerInvoiceStatusChart } from '@/components/charts/lazy-charts'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import type { OrderStatus } from '@/lib/validations/order'
import { ArrowRight, BarChart3, FileText, Landmark, ShoppingBag, ShoppingCart, Wallet } from 'lucide-react'
import { FxRatesWidget } from '@/components/fx/fx-rates-widget'

export default async function RetailerDashboardHome() {
  const t = await getTranslations('DashboardRetailer')
  const tErr = await getTranslations('RetailerDashboard')
  const locale = normalizeAppLocale(await getLocale())
  const res = await getRetailerDashboardStats()
  if ('error' in res) {
    return <p className="text-sm text-red-600">{tErr('error')}</p>
  }
  const s = res.stats
  const ccy = s.displayCurrency
  const activeOrders = s.pendingOrders
  const openInvoices = s.openInvoices
  const owing = s.balanceOwing

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/retailer/browse"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <ShoppingBag className="h-4 w-4" />
            {t('linkBrowse')}
          </Link>
          <Link
            href="/retailer/cart"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
          >
            <ShoppingCart className="h-4 w-4" />
            {t('linkCart')}
          </Link>
        </div>
      </div>

      {s.pendingDepositProofs > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-sky-200/80 bg-sky-50/90 p-4 shadow-sm dark:border-sky-900/40 dark:bg-sky-950/25 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-sky-100 p-2 dark:bg-sky-950/50">
              <Landmark className="h-5 w-5 text-sky-800 dark:text-sky-200" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t('depositProofsBannerTitle')}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{t('depositProofsBannerBody', { count: s.pendingDepositProofs })}</p>
            </div>
          </div>
          <Link
            href="/retailer/invoices"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            {t('depositProofsBannerCta')}
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/retailer/orders" className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-amber-100 p-2.5">
              <ShoppingCart className="h-5 w-5 text-amber-700" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums text-foreground">{activeOrders}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{t('activeOrders')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">{t('activeOrdersHint')}</p>
        </Link>

        <Link href="/retailer/invoices" className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <FileText className="h-5 w-5 text-blue-700" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </div>
          <p className="mt-4 text-3xl font-bold tabular-nums text-foreground">{openInvoices}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{t('openInvoices')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">{t('openInvoicesHint')}</p>
        </Link>

        <Link href="/retailer/ledger" className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-emerald-100 p-2.5">
              <Wallet className="h-5 w-5 text-emerald-700" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          </div>
          <p className="mt-4 text-2xl font-bold tabular-nums text-foreground">{formatCurrency(owing, ccy)}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{t('balanceOwing')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">{t('balanceOwingHint')}</p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('spendTrend')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('spendTrendHint')}</p>
            </div>
            <Link href="/retailer/payments" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
              {t('viewPayments')}
            </Link>
          </div>
          <div className="mt-4">
            <RetailerSpendChart data={s.monthlySpend} currency={ccy} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t('invoiceHealth')}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('invoiceHealthHint')}</p>
            </div>
            <Link href="/retailer/invoices" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
              {t('viewAll')}
            </Link>
          </div>
          <div className="mt-4">
            <RetailerInvoiceStatusChart counts={s.invoiceStatusCounts} />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <FxRatesWidget />
        <p className="text-xs text-muted-foreground">{t('ratesHint')}</p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">{t('recentOrders')}</h2>
          <Link href="/retailer/orders" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
            {t('viewAll')}
          </Link>
        </div>
        {s.recentOrders.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t('noOrders')}</p>
        ) : (
          <div className="divide-y divide-border/80">
            {s.recentOrders.map((o) => (
              <Link key={o.id} href={`/retailer/orders/${o.id}`} className="flex items-center justify-between px-5 py-3 transition hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{o.supplierName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTimeShort(o.createdAt, locale)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(o.total, ccy)}</span>
                  <OrderStatusBadge status={o.status as OrderStatus} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/retailer/browse" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('browseSuppliers')}</p>
            <p className="text-xs text-muted-foreground">{t('browseSuppliersHint')}</p>
          </div>
        </Link>
        <Link href="/retailer/invoices" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('manageInvoices')}</p>
            <p className="text-xs text-muted-foreground">{t('manageInvoicesHint')}</p>
          </div>
        </Link>
        <Link href="/retailer/ledger" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{t('ledger')}</p>
            <p className="text-xs text-muted-foreground">{t('ledgerHint')}</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
