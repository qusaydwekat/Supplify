import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  FileText,
  GitBranch,
  Package,
  ScrollText,
  Shield,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { AdminDashboardSnapshot } from '@/lib/data/admin/dashboard'

type Props = {
  data: AdminDashboardSnapshot
}

const ORDER_PIPELINE_KEYS = [
  'pending',
  'accepted',
  'modified',
  'rejected',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
] as const

const INV_PIPELINE_KEYS = ['issued', 'paid', 'partial', 'overdue'] as const

const PIPE_COLORS: Record<string, string> = {
  pending: 'bg-amber-500',
  accepted: 'bg-sky-500',
  modified: 'bg-violet-500',
  rejected: 'bg-rose-500',
  preparing: 'bg-cyan-500',
  shipped: 'bg-indigo-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-slate-400',
  issued: 'bg-slate-500',
  paid: 'bg-emerald-600',
  partial: 'bg-amber-600',
  overdue: 'bg-red-500',
}

export async function AdminDashboardView({ data }: Props) {
  const t = await getTranslations('Admin')
  const { stats, adminCount, orders, invoices, recentOrders, recentAudit } = data

  const orderTotal = Object.values(orders).reduce((a, b) => a + b, 0)
  const invTotal = Object.values(invoices).reduce((a, b) => a + b, 0)

  const statCards = [
    {
      label: t('statSuppliers'),
      value: stats.supplierCount,
      href: '/admin/suppliers',
      icon: Store,
      accent: 'from-emerald-500/15 to-emerald-500/5 text-emerald-700 dark:text-emerald-400',
    },
    {
      label: t('statRetailers'),
      value: stats.retailerUserCount,
      href: '/admin/retailers',
      icon: ShoppingCart,
      accent: 'from-sky-500/15 to-sky-500/5 text-sky-700 dark:text-sky-400',
    },
    {
      label: t('statOrders'),
      value: stats.orderCount,
      href: null,
      icon: Package,
      accent: 'from-violet-500/15 to-violet-500/5 text-violet-700 dark:text-violet-400',
    },
    {
      label: t('statInvoices'),
      value: stats.invoiceCount,
      href: null,
      icon: FileText,
      accent: 'from-amber-500/15 to-amber-500/5 text-amber-800 dark:text-amber-400',
    },
    {
      label: t('statProducts'),
      value: stats.productCount,
      href: null,
      icon: TrendingUp,
      accent: 'from-fuchsia-500/15 to-fuchsia-500/5 text-fuchsia-700 dark:text-fuchsia-400',
    },
    {
      label: t('statBanks'),
      value: stats.bankCount,
      href: '/admin/banks',
      icon: Building2,
      accent: 'from-slate-500/15 to-slate-500/5 text-slate-700 dark:text-slate-300',
    },
    {
      label: t('statBranches'),
      value: stats.branchCount,
      href: '/admin/banks',
      icon: GitBranch,
      accent: 'from-teal-500/15 to-teal-500/5 text-teal-700 dark:text-teal-400',
    },
    {
      label: t('statDefaultCurrency'),
      value: stats.defaultCurrency,
      href: '/admin/currencies',
      icon: CircleDollarSign,
      accent: 'from-lime-500/15 to-lime-500/5 text-lime-800 dark:text-lime-400',
    },
  ]

  const quickTiles = [
    { href: '/admin/users', title: t('linkUsers'), desc: t('tileUsersDesc'), icon: Users },
    { href: '/admin/currencies', title: t('linkCurrencies'), desc: t('tileFxDesc'), icon: Wallet },
    { href: '/admin/banks', title: t('tileBanksTitle'), desc: t('tileBanksDesc'), icon: Building2 },
    { href: '/admin/audit', title: t('linkAudit'), desc: t('tileAuditDesc'), icon: ScrollText },
  ]

  return (
    <div className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">{t('heroKicker')}</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('heroTitle')}</h1>
            <p className="text-sm leading-relaxed text-white/75">{t('heroSubtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-white/60">{t('heroAdmins')}</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-semibold tabular-nums">
                <Shield className="h-5 w-5 text-emerald-400" />
                {adminCount}
              </p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-white/60">{t('heroOpenOrders')}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {(orders.pending ?? 0) +
                  (orders.accepted ?? 0) +
                  (orders.modified ?? 0) +
                  (orders.preparing ?? 0) +
                  (orders.shipped ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionSnapshot')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((c) => {
            const Icon = c.icon
            const inner = (
              <div
                className={`group flex min-h-[104px] flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">{c.value}</p>
                  </div>
                  <div
                    className={`rounded-xl bg-gradient-to-br p-2.5 ${c.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                {c.href ? (
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                    {t('openSection')} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="mt-3 block h-4" aria-hidden />
                )}
              </div>
            )
            return c.href ? (
              <Link key={c.label} href={c.href} className="block outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
                {inner}
              </Link>
            ) : (
              <div key={c.label}>{inner}</div>
            )
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-5 xl:gap-8">
        <section className="space-y-4 xl:col-span-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionOrdersPipeline')}</h2>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{t('ordersPipelineHint')}</p>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {t('ordersTotal')}: {orderTotal}
              </span>
            </div>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
              {ORDER_PIPELINE_KEYS.map((key) => {
                const n = orders[key]
                const pct = orderTotal > 0 ? Math.round((n / orderTotal) * 1000) / 10 : 0
                if (!n) return null
                return (
                  <div
                    key={key}
                    title={`${key}: ${n} (${pct}%)`}
                    className={`${PIPE_COLORS[key] ?? 'bg-muted-foreground'} min-w-[2px] transition-all`}
                    style={{ width: `${orderTotal ? (n / orderTotal) * 100 : 0}%` }}
                  />
                )
              })}
            </div>
            <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              {ORDER_PIPELINE_KEYS.map((key) => (
                <li key={key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${PIPE_COLORS[key] ?? 'bg-muted-foreground'}`} />
                    <span className="font-medium capitalize text-foreground">{key}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">{orders[key]}</span>
                </li>
              ))}
            </ul>
          </div>

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionInvoicesPipeline')}</h2>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
              {INV_PIPELINE_KEYS.map((key) => {
                const n = invoices[key]
                if (!n) return null
                return (
                  <div
                    key={key}
                    className={`${PIPE_COLORS[key] ?? 'bg-muted-foreground'} min-w-[2px]`}
                    style={{ width: `${invTotal ? (n / invTotal) * 100 : 0}%` }}
                  />
                )
              })}
            </div>
            <ul className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              {INV_PIPELINE_KEYS.map((key) => (
                <li key={key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${PIPE_COLORS[key] ?? 'bg-muted-foreground'}`} />
                    <span className="font-medium capitalize text-foreground">{key}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">{invoices[key]}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-4 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionRecentAudit')}</h2>
            <Link href="/admin/audit" className="text-xs font-semibold text-primary hover:underline">
              {t('viewAll')}
            </Link>
          </div>
          <div className="max-h-[min(52vh,28rem)] space-y-2 overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-sm">
            {recentAudit.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t('emptyAudit')}</p>
            ) : (
              recentAudit.map((row) => (
                <div key={row.id} className="rounded-xl border border-transparent bg-muted/30 px-3 py-2.5 transition hover:border-border hover:bg-muted/50">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-foreground">{row.event_type}</span>
                    <time className="text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleString()}</time>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{row.order_id}</p>
                </div>
              ))
            )}
          </div>

          <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionRecentOrders')}</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="divide-y divide-border">
              {recentOrders.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">{t('emptyOrders')}</p>
              ) : (
                recentOrders.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-muted-foreground">{o.id}</p>
                      <p className="mt-0.5 font-medium capitalize text-foreground">{o.status}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-semibold tabular-nums text-foreground">{Number(o.total_price).toFixed(2)}</p>
                      <time className="text-[10px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</time>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionQuickTiles')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickTiles.map((tile) => {
            const Icon = tile.icon
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="group flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <div className="rounded-xl bg-primary/10 p-3 text-primary transition group-hover:bg-primary/15">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{tile.title}</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{tile.desc}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
