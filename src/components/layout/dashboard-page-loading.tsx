import { Skeleton } from '@/components/ui/skeleton'

type Variant = 'default' | 'table' | 'cards'

export function DashboardPageLoading({ variant = 'default' }: { variant?: Variant }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 max-w-[70%]" />
        <Skeleton className="h-4 w-80 max-w-[90%]" />
      </div>

      {variant === 'table' ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex gap-3 border-b border-border px-4 py-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="ms-auto h-9 w-24" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : variant === 'cards' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-20 rounded-full" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </>
      )}
    </div>
  )
}
