import Link from 'next/link'
import type { MarketplaceSupplierListRow } from '@/lib/data/marketplace-suppliers'
import { RatingBadge } from '@/components/reviews/rating-badge'
import { cn } from '@/lib/utils'
import { ArrowRight, MapPin, Truck } from 'lucide-react'

type BrowseT = (key: string, values?: Record<string, string | number>) => string
type CatT = (key: string) => string

type Props = {
  supplier: MarketplaceSupplierListRow
  businessName: string
  city?: string | null
  tBrowse: BrowseT
  tCat: CatT
}

export function MarketplaceSupplierListCard({
  supplier: s,
  businessName,
  city,
  tBrowse,
  tCat,
}: Props) {
  const cats = (s.marketplace_categories ?? []).filter(Boolean) as string[]
  const areasPreview = s.delivery_areas?.slice(0, 3).join(', ') ?? ''
  const areasMore = (s.delivery_areas?.length ?? 0) > 3 ? '…' : ''
  const hasRating = Number(s.avg_rating) > 0 && (s.review_count ?? 0) > 0
  const initial = businessName.trim().charAt(0).toUpperCase() || 'S'

  return (
    <Link
      href={`/retailer/browse/${s.id}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card',
        'shadow-sm shadow-slate-900/5 transition duration-200',
        'hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
      )}
    >
      <div className="relative flex items-center justify-center bg-gradient-to-br from-primary/12 via-muted/50 to-muted px-4 py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary))_0%,transparent_55%)] opacity-[0.14]"
        />
        <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-2 border-background bg-background shadow-md ring-1 ring-border/60 transition duration-300 group-hover:scale-105 group-hover:shadow-lg">
          {s.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
              <span className="text-2xl font-bold tracking-tight">{initial}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-primary/70">
                {tBrowse('logo')}
              </span>
            </div>
          )}
        </div>
        {hasRating ? (
          <div className="absolute end-3 top-3 rounded-full border border-border/60 bg-background/95 px-2.5 py-1 shadow-sm backdrop-blur-sm">
            <RatingBadge
              avgRating={Number(s.avg_rating)}
              reviewCount={s.review_count ?? 0}
              size="sm"
              className="text-[11px]"
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
          {businessName}
        </h2>

        {city ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/60" aria-hidden />
            <span className="truncate">{city}</span>
          </p>
        ) : null}

        {cats.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {cats.slice(0, 3).map((slug) => (
              <span
                key={slug}
                className="inline-flex max-w-full truncate rounded-full border border-primary/15 bg-primary/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
              >
                {tCat(slug)}
              </span>
            ))}
            {cats.length > 3 ? (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                +{cats.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}

        {s.description ? (
          <p className="mt-3 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            {s.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        {s.delivery_areas && s.delivery_areas.length > 0 ? (
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/50" aria-hidden />
            <span>{tBrowse('deliversLabel', { areas: `${areasPreview}${areasMore}` })}</span>
          </p>
        ) : null}

        <div className="mt-4 border-t border-border/80 pt-4">
          <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
            {tBrowse('open')}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  )
}
