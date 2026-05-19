'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { RetailerBalance } from '@/lib/data/ledger'
import { formatLedgerMoney } from '@/lib/format-money'
import { cn } from '@/lib/utils'

type Props = {
  balances: RetailerBalance[]
  currency: string
  baseHref: string
}

export function RetailerBalancesTable({ balances, currency, baseHref }: Props) {
  const t = useTranslations('LedgerPage')
  const [open, setOpen] = useState(false)

  if (!balances.length) return null

  return (
    <section className="app-surface print:border-none print:shadow-none">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/50 print:hidden"
      >
        <span>{t('retailerBreakdown')}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/80 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{t('colRetailer')}</th>
                <th className="px-4 py-2 text-end">{t('totalInvoiced')}</th>
                <th className="px-4 py-2 text-end">{t('totalCollected')}</th>
                <th className="px-4 py-2 text-end">{t('outstandingBalance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {balances.map((b) => (
                <tr key={b.retailerId} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <a
                      href={`${baseHref}?partnerId=${b.retailerId}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {b.retailerName}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-end tabular-nums text-slate-900">{formatLedgerMoney(b.totalInvoiced, currency)}</td>
                  <td className="px-4 py-2 text-end tabular-nums text-emerald-700">{formatLedgerMoney(b.totalCollected, currency)}</td>
                  <td className={cn('px-4 py-2 text-end font-semibold tabular-nums', b.outstanding > 0.005 ? 'text-red-700' : 'text-emerald-700')}>
                    {formatLedgerMoney(b.outstanding, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
