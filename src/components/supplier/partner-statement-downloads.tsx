'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'

export type StatementPartnerOption = {
  retailer_id: string
  label: string
}

export function PartnerStatementDownloads({ partners, currencyCode }: { partners: StatementPartnerOption[]; currencyCode: string }) {
  const t = useTranslations('FinancePage')
  const [retailerId, setRetailerId] = useState(partners[0]?.retailer_id ?? '')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (retailerId) p.set('retailerId', retailerId)
    if (from.trim()) p.set('from', from.trim())
    if (to.trim()) p.set('to', to.trim())
    return p.toString()
  }, [retailerId, from, to])

  if (!partners.length) {
    return <p className="text-sm text-slate-600">{t('noPartnersForStatements')}</p>
  }

  const base = `/api/supplier/statements`
  const suffix = qs ? `?${qs}` : ''

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{t('partnerStatementsTitle')}</h2>
        <p className="mt-1 text-xs text-slate-600">{t('partnerStatementsHint', { code: currencyCode })}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          {t('statementRetailer')}
          <select
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={retailerId}
            onChange={(e) => setRetailerId(e.target.value)}
          >
            {partners.map((p) => (
              <option key={p.retailer_id} value={p.retailer_id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-600">
            {t('statementFrom')}
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            {t('statementTo')}
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <a
          href={`${base}/csv${suffix}`}
          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 font-medium text-slate-900 hover:bg-slate-50"
        >
          {t('downloadCsv')}
        </a>
        <a
          href={`${base}/pdf${suffix}`}
          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 font-medium text-slate-900 hover:bg-slate-50"
        >
          {t('downloadPdf')}
        </a>
        <a
          href={`${base}/xlsx${suffix}`}
          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 font-medium text-slate-900 hover:bg-slate-50"
        >
          {t('downloadXlsx')}
        </a>
      </div>
    </div>
  )
}
