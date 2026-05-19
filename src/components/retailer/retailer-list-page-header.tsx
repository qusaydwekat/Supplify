import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  icon: LucideIcon
  title: string
  subtitle: string
  children?: ReactNode
}

export function RetailerListPageHeader({ icon: Icon, title, subtitle, children }: Props) {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-primary/12 via-background to-background px-5 py-6 sm:px-8 sm:py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20 sm:h-14 sm:w-14">
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>
          </div>
        </div>
        {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </header>
  )
}
