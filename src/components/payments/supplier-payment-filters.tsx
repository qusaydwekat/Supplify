'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export function SupplierPaymentFilters() {
  const t = useTranslations('SupplierPaymentFilters')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const methods = useMemo(
    () => [
      { value: '', label: t('methodAll') },
      { value: 'cash', label: t('methodCash') },
      { value: 'bank', label: t('methodBank') },
      { value: 'cheque', label: t('methodCheque') },
      { value: 'other', label: t('methodOther') },
    ],
    [t],
  )

  const initialMethod = searchParams.get('method') ?? ''
  const initialFrom = searchParams.get('from') ?? ''
  const initialTo = searchParams.get('to') ?? ''

  const [method, setMethod] = useState(initialMethod)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)

  useEffect(() => {
    setMethod(searchParams.get('method') ?? '')
    setFrom(searchParams.get('from') ?? '')
    setTo(searchParams.get('to') ?? '')
  }, [searchParams])

  const apply = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')
    if (method) next.set('method', method)
    else next.delete('method')
    if (from) next.set('from', from)
    else next.delete('from')
    if (to) next.set('to', to)
    else next.delete('to')
    const q = next.toString()
    startTransition(() => {
      router.push(q ? `${pathname}?${q}` : pathname)
    })
  }, [from, method, pathname, router, searchParams, to])

  const clear = useCallback(() => {
    setMethod('')
    setFrom('')
    setTo('')
    startTransition(() => {
      router.push(pathname)
    })
  }, [pathname, router])

  const hasFilters = useMemo(() => Boolean(method || from || to), [from, method, to])

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="pay-method" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {t('method')}
        </label>
        <select
          id="pay-method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full min-w-[140px] rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          {methods.map((m) => (
            <option key={m.value || 'all'} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="pay-from" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {t('from')}
        </label>
        <input
          id="pay-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>
      <div>
        <label htmlFor="pay-to" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {t('to')}
        </label>
        <input
          id="pay-to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>
      <button
        type="button"
        onClick={() => apply()}
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {t('apply')}
      </button>
      {hasFilters && (
        <button
          type="button"
          onClick={() => clear()}
          disabled={pending}
          className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          {t('clear')}
        </button>
      )}
    </div>
  )
}
