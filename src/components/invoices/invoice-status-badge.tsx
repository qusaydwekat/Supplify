'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { InvoiceStatus } from '@/lib/invoices-types'

type Props = {
  status: InvoiceStatus
  dueDate: string | null
}

export function InvoiceStatusBadge({ status, dueDate }: Props) {
  const t = useTranslations('InvoiceStatus')
  const overdue = status === 'issued' && dueDate && new Date(dueDate) < new Date()

  if (overdue) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-900 ring-1 ring-inset ring-red-200/60">
        {t('overdueShort')}
      </span>
    )
  }

  const styles: Record<InvoiceStatus, string> = {
    issued: 'bg-amber-100 text-amber-900 ring-amber-200/60',
    paid: 'bg-emerald-100 text-emerald-900 ring-emerald-200/60',
    partial: 'bg-sky-100 text-sky-900 ring-sky-200/60',
    overdue: 'bg-red-100 text-red-900 ring-red-200/60',
  }

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
