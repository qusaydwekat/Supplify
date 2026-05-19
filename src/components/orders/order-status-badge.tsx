'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/lib/validations/order'

const styles: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-900 ring-amber-200/60',
  accepted: 'bg-emerald-100 text-emerald-900 ring-emerald-200/60',
  modified: 'bg-violet-100 text-violet-900 ring-violet-200/60',
  rejected: 'bg-red-100 text-red-900 ring-red-200/60',
  preparing: 'bg-sky-100 text-sky-900 ring-sky-200/60',
  shipped: 'bg-indigo-100 text-indigo-900 ring-indigo-200/60',
  delivered: 'bg-slate-200 text-slate-800 ring-slate-300',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations('OrderStatus')
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        styles[status],
      )}
    >
      {t(status)}
    </span>
  )
}
