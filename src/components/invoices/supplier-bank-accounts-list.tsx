'use client'

import { useTranslations } from 'next-intl'
import type { SupplierBankAccountPublic } from '@/lib/data/supplier-bank-accounts'

type Props = {
  accounts: SupplierBankAccountPublic[]
  /** Extra wrapper classes */
  className?: string
}

/** Wiring instructions shown to retailers before they submit a deposit proof. */
export function SupplierBankAccountsList({ accounts, className }: Props) {
  const t = useTranslations('DepositProofForm')

  if (!accounts.length) {
    return (
      <p
        className={
          className ??
          'rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground'
        }
      >
        {t('noBankAccountsYet')}
      </p>
    )
  }

  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('depositTo')}</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {accounts.map((a) => (
          <li key={a.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
              <span>{a.bank_name}</span>
              {a.branch ? <span className="text-xs font-normal text-muted-foreground">{a.branch}</span> : null}
              {a.is_default ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {t('preferred')}
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{a.account_holder}</div>
            {a.iban ? (
              <div className="mt-2 font-mono text-xs text-foreground">{a.iban}</div>
            ) : a.account_number ? (
              <div className="mt-2 font-mono text-xs text-foreground">{a.account_number}</div>
            ) : null}
            {a.swift ? (
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                SWIFT/BIC: {a.swift}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
