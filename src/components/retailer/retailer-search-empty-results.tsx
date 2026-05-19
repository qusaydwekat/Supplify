import Link from 'next/link'
import { PackageOpen, Store } from 'lucide-react'

type Props = {
  kind: 'suppliers' | 'products'
  title: string
  hint: string
  switchLabel: string
  switchHref: string
}

export function RetailerSearchEmptyResults({
  kind,
  title,
  hint,
  switchLabel,
  switchHref,
}: Props) {
  const Icon = kind === 'suppliers' ? Store : PackageOpen

  return (
    <div className="flex flex-col items-center px-6 py-16 text-center sm:py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-border">
        <Icon className="h-8 w-8" aria-hidden />
      </div>
      <p className="mt-5 max-w-sm text-base font-semibold text-foreground">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{hint}</p>
      <Link
        href={switchHref}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
      >
        {switchLabel}
      </Link>
    </div>
  )
}
