import { Package, AlertTriangle, TrendingDown } from 'lucide-react'
import { formatMoney } from '@/lib/format-money'
import { cn } from '@/lib/utils'

type Props = {
  totalValuation: number
  reorderCount: number
  lowStockCount: number
  currencyCode: string
  labels: {
    totalValuation: string
    valuationHint: string
    reorderCandidates: string
    reorderHint: string
    lowStock: string
    lowStockHint: string
    dataFreshness: string
  }
}

export function InventoryInsightsSummary({
  totalValuation,
  reorderCount,
  lowStockCount,
  currencyCode,
  labels,
}: Props) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{labels.dataFreshness}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {labels.totalValuation}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {formatMoney(totalValuation, currencyCode)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{labels.valuationHint}</p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'rounded-2xl border p-4 shadow-sm sm:p-5',
            reorderCount > 0
              ? 'border-amber-300/80 bg-gradient-to-br from-amber-50 to-card dark:from-amber-950/30'
              : 'border-border bg-card',
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                reorderCount > 0 ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200' : 'bg-muted text-muted-foreground',
              )}
            >
              <TrendingDown className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-900 dark:text-amber-100">
                {labels.reorderCandidates}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-950 dark:text-amber-50">{reorderCount}</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">{labels.reorderHint}</p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'rounded-2xl border p-4 shadow-sm sm:p-5',
            lowStockCount > 0
              ? 'border-rose-300/70 bg-gradient-to-br from-rose-50/80 to-card dark:from-rose-950/25'
              : 'border-border bg-card',
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                lowStockCount > 0 ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200' : 'bg-muted text-muted-foreground',
              )}
            >
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-rose-900 dark:text-rose-100">
                {labels.lowStock}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-rose-950 dark:text-rose-50">{lowStockCount}</p>
              <p className="mt-1 text-xs leading-relaxed text-rose-900/80 dark:text-rose-100/80">{labels.lowStockHint}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
