import Link from 'next/link'
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, Compass, PackageSearch, ShoppingBag, Sparkles } from 'lucide-react'
import { RetailerSearchBar } from '@/components/retailer/retailer-search-bar'

const EXAMPLE_KEYS = ['exampleQuery1', 'exampleQuery2', 'exampleQuery3'] as const

export async function RetailerSearchEmpty() {
  const t = await getTranslations('SearchPage')

  const examples = EXAMPLE_KEYS.map((key) => ({
    key,
    label: t(key),
    href: `/retailer/search?q=${encodeURIComponent(t(key))}&tab=suppliers`,
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-6 sm:space-y-8">
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-primary/15 via-background to-primary/5 px-5 py-10 shadow-sm sm:px-10 sm:py-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -start-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative mx-auto max-w-xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
            <PackageSearch className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">{t('title')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{t('subtitle')}</p>
          <p className="mt-2 text-sm text-muted-foreground/90">{t('emptyStateHint')}</p>
        </div>

        <div className="relative mx-auto mt-8 max-w-lg">
          <RetailerSearchBar defaultQ="" tab="suppliers" showTabs={false} variant="hero" />
        </div>

        <div className="relative mt-8">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('trySearching')}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {examples.map((ex) => (
              <Link
                key={ex.key}
                href={ex.href}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border/80 bg-card/95 px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary/80" aria-hidden />
                {ex.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink
          href="/retailer/browse"
          icon={<Compass className="h-6 w-6" aria-hidden />}
          title={t('quickBrowse')}
          hint={t('quickBrowseHint')}
          iconClass="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
        />
        <QuickLink
          href="/retailer/cart"
          icon={<ShoppingBag className="h-6 w-6" aria-hidden />}
          title={t('quickCart')}
          hint={t('quickCartHint')}
          iconClass="bg-emerald-500/10 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white dark:text-emerald-400"
        />
      </div>
    </div>
  )
}

function QuickLink({
  href,
  icon,
  title,
  hint,
  iconClass,
}: {
  href: string
  icon: ReactNode
  title: string
  hint: string
  iconClass: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${iconClass}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-start">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
      </div>
      <ArrowRight
        className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden
      />
    </Link>
  )
}
