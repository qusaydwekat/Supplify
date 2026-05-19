'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

type Option = { id: string; label: string }

type Props = {
  partnerOptions: Option[]
  activePartnerId: string | null
  allPartnersLabel: string
  partnerSelectLabel: string
  csvHref: string
  statementHref: string
}

export function LedgerFilters({
  partnerOptions,
  activePartnerId,
  allPartnersLabel,
  partnerSelectLabel,
  csvHref,
  statementHref,
}: Props) {
  const t = useTranslations('LedgerPage')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    next.delete('rbPage')
    next.delete('rbPageSize')
    const q = next.toString()
    router.push(q ? `${pathname}?${q}` : pathname)
  }

  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const type = searchParams.get('type') ?? ''

  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
      <div className="min-w-[180px] flex-1">
        <label htmlFor="ledger-partner" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {partnerSelectLabel}
        </label>
        <select
          id="ledger-partner"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          value={activePartnerId ?? ''}
          onChange={(e) => update('partnerId', e.target.value || null)}
        >
          <option value="">{allPartnersLabel}</option>
          {partnerOptions.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="ledger-type" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {t('filterType')}
        </label>
        <select
          id="ledger-type"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          value={type}
          onChange={(e) => update('type', e.target.value || null)}
        >
          <option value="">{t('typeAll')}</option>
          <option value="invoice">{t('typeInvoices')}</option>
          <option value="payment">{t('typePayments')}</option>
        </select>
      </div>

      <div>
        <label htmlFor="ledger-from" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {t('dateFrom')}
        </label>
        <input
          id="ledger-from"
          type="date"
          value={from}
          onChange={(e) => update('from', e.target.value || null)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      <div>
        <label htmlFor="ledger-to" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {t('dateTo')}
        </label>
        <input
          id="ledger-to"
          type="date"
          value={to}
          onChange={(e) => update('to', e.target.value || null)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>

      <div className="flex gap-2">
        <a
          href={csvHref}
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
        >
          {t('downloadCsv')}
        </a>
        <a
          href={statementHref}
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
        >
          {t('downloadStatement')}
        </a>
      </div>
    </div>
  )
}
