import type { ReactNode } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { ChequeStatusBadge } from '@/components/payments/cheque-status-badge'
import { cn } from '@/lib/utils'
import { formatLedgerMoney, type LedgerFilterOption, type LedgerListRow } from '@/lib/data/ledger'
import { formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { LedgerManualEntryActions } from '@/components/ledger/ledger-manual-entry-actions'

type Props = {
  rows: LedgerListRow[]
  youLabel: string
  themLabel: string
  currency?: string
  role?: 'supplier' | 'retailer'
  footer?: ReactNode
  /** When set (supplier ledger), manual credit/debit rows show edit/delete */
  retailerOptions?: LedgerFilterOption[]
}

function amountColor(type: string): string {
  if (type === 'invoice' || type === 'debit_note') return 'text-red-600 dark:text-red-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

function runningBalanceColor(balance: number): string {
  if (balance > 0.005) return 'text-red-700 dark:text-red-400'
  if (Math.abs(balance) <= 0.005) return 'text-emerald-700 dark:text-emerald-400'
  return 'text-foreground'
}

export async function LedgerTable({
  rows,
  youLabel,
  themLabel,
  currency = 'USD',
  role = 'supplier',
  footer,
  retailerOptions,
}: Props) {
  const t = await getTranslations('LedgerTable')
  const locale = normalizeAppLocale(await getLocale())

  const showManualActions = role === 'supplier' && retailerOptions && retailerOptions.length > 0
  const showChequeColumn = role === 'retailer'
  const basePath = role === 'supplier' ? '/supplier' : '/retailer'

  const typeLabel = (type: string) => {
    switch (type) {
      case 'invoice':
        return t('type_invoice')
      case 'payment':
        return t('type_payment')
      case 'credit_note':
        return t('type_credit_note')
      case 'debit_note':
        return t('type_debit_note')
      default:
        return type.replace('_', ' ')
    }
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    )
  }

  const renderDescriptionLink = (row: LedgerListRow) => {
    const label = row.description ?? '—'
    if (row.type === 'invoice') {
      return (
        <Link href={`${basePath}/invoices/${row.reference_id}`} className="font-medium underline-offset-2 hover:underline">
          {label}
        </Link>
      )
    }
    if (row.type === 'payment' && row.payment_invoice_id) {
      return (
        <Link href={`${basePath}/invoices/${row.payment_invoice_id}`} className="font-medium underline-offset-2 hover:underline">
          {label}
        </Link>
      )
    }
    return <span>{label}</span>
  }

  const renderChequeCell = (row: LedgerListRow) => {
    if (!showChequeColumn) return null
    return (
      <ChequeStatusBadge
        method={row.payment_method}
        status={row.cheque_status}
        bounceReason={row.cheque_bounce_reason}
        showBounceDetail={row.cheque_status === 'bounced'}
      />
    )
  }

  return (
    <div className="app-surface overflow-hidden rounded-2xl">
      <ul className="divide-y divide-border/80 lg:hidden">
        {rows.map((row) => {
          const isManual = row.type === 'credit_note' || row.type === 'debit_note'
          const absAmount = isManual ? Math.abs(row.amount) : 0
          const rid = row.retailer_id ?? ''

          return (
            <li key={row.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{formatDateTimeShort(row.created_at, locale)}</p>
                  <p className="mt-0.5 text-sm font-semibold capitalize text-foreground">{typeLabel(row.type)}</p>
                </div>
                <p className={cn('text-lg font-bold tabular-nums', amountColor(row.type))}>
                  {row.amount >= 0 ? '+' : ''}
                  {formatLedgerMoney(row.amount, currency)}
                </p>
              </div>
              <p className="mt-2 truncate text-sm text-muted-foreground">{row.counterpart}</p>
              <p className="mt-1 text-sm text-foreground">{renderDescriptionLink(row)}</p>
              {row.note ? (
                <p className="mt-1 text-xs text-muted-foreground" title={row.note}>
                  {row.note.length > 80 ? `${row.note.slice(0, 80)}…` : row.note}
                </p>
              ) : null}
              {showChequeColumn && row.type === 'payment' ? (
                <div className="mt-3 border-t border-border/80 pt-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('colChequeStatus')}</p>
                  <div className="mt-1.5">{renderChequeCell(row)}</div>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between border-t border-border/80 pt-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t('runningBalance')}</span>
                <span className={cn('text-sm font-semibold tabular-nums', runningBalanceColor(row.runningBalance))}>
                  {formatLedgerMoney(row.runningBalance, currency)}
                </span>
              </div>
              {showManualActions && isManual && rid ? (
                <div className="mt-3 flex justify-end">
                  <LedgerManualEntryActions
                    entryId={row.id}
                    entryType={row.type === 'credit_note' ? 'credit_note' : 'debit_note'}
                    retailerId={rid}
                    amountAbs={absAmount}
                    description={row.description ?? ''}
                    retailers={retailerOptions}
                  />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="hidden overflow-x-auto [-webkit-overflow-scrolling:touch] lg:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/80 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t('date')}</th>
              <th className="px-4 py-3">{t('type')}</th>
              <th className="px-4 py-3">{themLabel}</th>
              <th className="px-4 py-3">{t('description')}</th>
              {showChequeColumn ? <th className="px-4 py-3">{t('colChequeStatus')}</th> : null}
              <th className="px-4 py-3 text-end">{t('amount')}</th>
              <th className="px-4 py-3 text-end">{t('runningBalance')}</th>
              {showManualActions ? (
                <th className="w-[1%] whitespace-nowrap px-4 py-3 text-end">{t('actions')}</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {rows.map((row) => {
              const isManual = row.type === 'credit_note' || row.type === 'debit_note'
              const absAmount = isManual ? Math.abs(row.amount) : 0
              const rid = row.retailer_id ?? ''

              return (
                <tr key={row.id} className="transition-colors hover:bg-muted/50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {formatDateTimeShort(row.created_at, locale)}
                  </td>
                  <td className="px-4 py-2.5 capitalize text-foreground">{typeLabel(row.type)}</td>
                  <td className="max-w-[160px] truncate px-4 py-2.5 text-foreground">{row.counterpart}</td>
                  <td className="max-w-[220px] px-4 py-2.5 text-muted-foreground">
                    {renderDescriptionLink(row)}
                    {row.note ? (
                      <span className="ms-2 text-xs" title={row.note}>
                        [{row.note.length > 30 ? `${row.note.slice(0, 30)}…` : row.note}]
                      </span>
                    ) : null}
                  </td>
                  {showChequeColumn ? (
                    <td className="px-4 py-2.5 align-top">{renderChequeCell(row)}</td>
                  ) : null}
                  <td className={cn('px-4 py-2.5 text-end font-medium tabular-nums', amountColor(row.type))}>
                    {row.amount >= 0 ? '+' : ''}
                    {formatLedgerMoney(row.amount, currency)}
                  </td>
                  <td className={cn('px-4 py-2.5 text-end text-sm font-semibold tabular-nums', runningBalanceColor(row.runningBalance))}>
                    {formatLedgerMoney(row.runningBalance, currency)}
                  </td>
                  {showManualActions ? (
                    <td className="px-4 py-2.5 text-end align-top">
                      {isManual && rid ? (
                        <LedgerManualEntryActions
                          entryId={row.id}
                          entryType={row.type === 'credit_note' ? 'credit_note' : 'debit_note'}
                          retailerId={rid}
                          amountAbs={absAmount}
                          description={row.description ?? ''}
                          retailers={retailerOptions}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">{t('footer', { you: youLabel })}</p>
      {footer}
    </div>
  )
}
