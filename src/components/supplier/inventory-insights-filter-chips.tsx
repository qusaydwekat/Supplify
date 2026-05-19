import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { InventoryInsightFilter } from '@/lib/data/inventory-insights'

type Props = {
  active: InventoryInsightFilter
  reorderCount: number
  lowStockCount: number
  labels: {
    all: string
    reorder: string
    lowStock: string
    noSales: string
    active: string
  }
}

function buildHref(filter: InventoryInsightFilter) {
  if (filter === 'all') return '/supplier/inventory-insights'
  return `/supplier/inventory-insights?filter=${filter}`
}

export function InventoryInsightsFilterChips({ active, reorderCount, lowStockCount, labels }: Props) {
  const chips: { key: InventoryInsightFilter; label: string; count?: number }[] = [
    { key: 'all', label: labels.all },
    { key: 'reorder', label: labels.reorder, count: reorderCount },
    { key: 'low_stock', label: labels.lowStock, count: lowStockCount },
    { key: 'no_sales', label: labels.noSales },
    { key: 'active', label: labels.active },
  ]

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={labels.all}>
      {chips.map((chip) => {
        const isActive = active === chip.key
        return (
          <Link
            key={chip.key}
            href={buildHref(chip.key)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm',
              isActive
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5',
            )}
          >
            {chip.label}
            {chip.count != null && chip.count > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums sm:text-xs',
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {chip.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </div>
  )
}
