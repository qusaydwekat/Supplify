import { cn } from '@/lib/utils'

type Props = {
  count: number
  label: string
  active?: boolean
}

export function NavCountBadge({ count, label, active }: Props) {
  if (count <= 0) return null

  const display = count > 99 ? '99+' : String(count)

  return (
    <span
      className={cn(
        'ms-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums leading-none',
        active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-rose-500 text-white shadow-sm',
      )}
      aria-label={label}
      title={label}
    >
      {display}
    </span>
  )
}
