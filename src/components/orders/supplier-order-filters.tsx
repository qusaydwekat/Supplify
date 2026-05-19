'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { orderStatuses } from '@/lib/validations/order'

export function SupplierOrderFilters() {
  const t = useTranslations('SupplierOrderFilters')
  const tStatus = useTranslations('OrderStatus')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const statusOptions = useMemo(
    () => [{ value: '', label: t('statusAll') }, ...orderStatuses.map((s) => ({ value: s, label: tStatus(s) }))],
    [t, tStatus],
  )

  const initialStatus = searchParams.get('status') ?? ''
  const initialSearch = searchParams.get('q') ?? ''
  const initialFrom = searchParams.get('from') ?? ''
  const initialTo = searchParams.get('to') ?? ''

  const [status, setStatus] = useState(initialStatus)
  const [q, setQ] = useState(initialSearch)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)

  useEffect(() => {
    setStatus(searchParams.get('status') ?? '')
    setQ(searchParams.get('q') ?? '')
    setFrom(searchParams.get('from') ?? '')
    setTo(searchParams.get('to') ?? '')
  }, [searchParams])

  const apply = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')
    if (status) next.set('status', status)
    else next.delete('status')
    if (q.trim()) next.set('q', q.trim())
    else next.delete('q')
    if (from) next.set('from', from)
    else next.delete('from')
    if (to) next.set('to', to)
    else next.delete('to')
    const query = next.toString()
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname)
    })
  }, [from, pathname, q, router, searchParams, status, to])

  const clear = useCallback(() => {
    setStatus('')
    setQ('')
    setFrom('')
    setTo('')
    startTransition(() => {
      router.push(pathname)
    })
  }, [pathname, router])

  const hasFilters = useMemo(() => Boolean(status || q.trim() || from || to), [from, q, status, to])

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <label htmlFor="ord-status" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {t('status')}
        </label>
        <select
          id="ord-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full min-w-[160px] rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          {statusOptions.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[200px] flex-1">
        <label htmlFor="ord-q" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {t('search')}
        </label>
        <input
          id="ord-q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>
      <div>
        <label htmlFor="ord-from" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {t('from')}
        </label>
        <input
          id="ord-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
      </div>
      <div>
        <label htmlFor="ord-to" className="mb-1 block text-xs font-medium uppercase text-slate-500">
          {t('to')}
        </label>
        <input
          id="ord-to"
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
