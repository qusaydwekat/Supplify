export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <div className="animate-pulse rounded-md bg-muted/60" style={{ height }} aria-hidden />
}
