import Link from 'next/link'
import { ArrowRight, MapPin, Package, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  name: string
  description: string | null
  category: string | null
  imageUrl: string | null
  supplierId: string
  supplierLabel: string
  city?: string
  priceBadge: string | null
  viewStoreLabel: string
  noImageLabel: string
}

export function RetailerSearchProductCard({
  name,
  description,
  category,
  imageUrl,
  supplierId,
  supplierLabel,
  city,
  priceBadge,
  viewStoreLabel,
  noImageLabel,
}: Props) {
  const supplierInitial = supplierLabel.trim().charAt(0).toUpperCase() || 'S'

  return (
    <Link
      href={`/retailer/browse/${supplierId}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card',
        'shadow-sm shadow-slate-900/5 transition duration-200',
        'hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
      )}
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-gradient-to-br from-primary/8 via-muted to-muted/50 sm:aspect-[4/3]">
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent"
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Package className="h-10 w-10 opacity-35" aria-hidden />
            <span className="text-xs font-medium">{noImageLabel}</span>
          </div>
        )}

        {category ? (
          <span className="absolute start-2.5 top-2.5 max-w-[65%] truncate rounded-lg border border-border/50 bg-background/92 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground shadow-sm backdrop-blur-sm">
            {category}
          </span>
        ) : null}

        {priceBadge ? (
          <span className="absolute end-2.5 top-2.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-md ring-2 ring-background/50">
            {priceBadge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/15">
            {supplierInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {supplierLabel}
            </p>
            {city ? (
              <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0 text-primary/50" aria-hidden />
                {city}
              </p>
            ) : null}
          </div>
        </div>

        <h2 className="mt-3 line-clamp-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
          {name}
        </h2>

        {description ? (
          <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        <span className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
          <Store className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          {viewStoreLabel}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  )
}
