'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const PARAM = 'partnerId'

type Option = { id: string; label: string }

type Props = {
  options: Option[]
  activeId: string | null
  allLabel: string
  /** e.g. "Retailer" for supplier view */
  selectLabel: string
}

export function LedgerPartnerFilter({ options, activeId, allLabel, selectLabel }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setPartner(id: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (id) next.set(PARAM, id)
    else next.delete(PARAM)
    next.delete('page')
    const q = next.toString()
    router.push(q ? `${pathname}?${q}` : pathname)
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="ledger-partner" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {selectLabel}
        </label>
        <select
          id="ledger-partner"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          value={activeId ?? ''}
          onChange={(e) => setPartner(e.target.value || null)}
        >
          <option value="">{allLabel}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <a
        href={
          activeId
            ? `/api/ledger/export?${new URLSearchParams({ partnerId: activeId }).toString()}`
            : '/api/ledger/export'
        }
        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50"
      >
        Download CSV
      </a>
    </div>
  )
}
