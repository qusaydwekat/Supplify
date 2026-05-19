import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { supabaseServer } from '@/lib/supabase/server'
import { formatDateDayMonthYear, normalizeAppLocale } from '@/lib/format-datetime'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

type Search = {
  q?: string
  page?: string
  category?: string
  status?: string
  lowStock?: string
}

export default async function SupplierProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const t = await getTranslations('ProductsPage')
  const tCommon = await getTranslations('Common')
  const locale = normalizeAppLocale(await getLocale())
  const sp = await searchParams
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) redirect('/retailer')

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const q = sp.q?.trim() ?? ''
  const category = sp.category?.trim() ?? ''
  const status = sp.status ?? 'all'
  const lowStockOnly = sp.lowStock === '1'

  let query = supabase
    .from('products')
    .select(
      'id, name, category, is_active, has_variations, updated_at, product_variations(id, stock_quantity)',
      { count: 'exact' },
    )
    .eq('supplier_id', supplier.id)
    .order('updated_at', { ascending: false })

  if (q) query = query.ilike('name', `%${q}%`)
  if (category) query = query.eq('category', category)
  if (status === 'active') query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)

  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data: rows, error, count } = await query.range(from, to)

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {t('loadErrorWithMessage', { message: error.message })}
      </div>
    )
  }

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const buildQuery = (nextPage: number) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (category) p.set('category', category)
    if (status && status !== 'all') p.set('status', status)
    if (lowStockOnly) p.set('lowStock', '1')
    if (nextPage > 1) p.set('page', String(nextPage))
    const qs = p.toString()
    return qs ? `?${qs}` : ''
  }

  const fmtDate = (d: string | Date) => formatDateDayMonthYear(d, locale)

  // summary stats for current filtered set page (fast + simple)
  const pageRows = rows ?? []
  const lowStockCount = pageRows.filter((row: any) => {
    const vars = (row as any).product_variations as { id: string; stock_quantity: number }[] | null
    return (vars ?? []).some((v) => Number(v.stock_quantity) < 10)
  }).length
  const activeCount = pageRows.filter((r: any) => Boolean(r.is_active)).length

  const filteredRows = lowStockOnly
    ? pageRows.filter((row: any) => {
        const vars = (row as any).product_variations as { id: string; stock_quantity: number }[] | null
        return (vars ?? []).some((v) => Number(v.stock_quantity) < 10)
      })
    : pageRows

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/supplier/products/new"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          {t('addProduct')}
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm shadow-slate-900/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('pageProducts')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{filteredRows.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm shadow-slate-900/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('pageActive')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">{t('pageLowStock')}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-950">{lowStockCount}</p>
        </div>
      </section>

      <form method="get" className="app-surface-muted flex flex-wrap items-end gap-3 p-4 sm:p-5">
        <div className="min-w-[min(100%,12rem)] flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('search')}</label>
          <input
            name="q"
            defaultValue={q}
            placeholder={t('searchPlaceholder')}
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="w-full min-w-0 sm:w-40">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('category')}</label>
          <input
            name="category"
            defaultValue={category}
            placeholder={t('categoryPlaceholder')}
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="w-full sm:w-36">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('status')}</label>
          <select
            name="status"
            defaultValue={status}
            className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">{t('statusAll')}</option>
            <option value="active">{t('statusActive')}</option>
            <option value="inactive">{t('statusInactive')}</option>
          </select>
        </div>
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm">
          <input type="checkbox" name="lowStock" value="1" defaultChecked={lowStockOnly} />
          <span className="text-sm">{t('lowStockOnly')}</span>
        </label>
        <button
          type="submit"
          className="min-h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto"
        >
          {tCommon('filter')}
        </button>
        {(q || category || (status && status !== 'all') || lowStockOnly) && (
          <Link href="/supplier/products" className="min-h-10 w-full rounded-lg border border-border bg-card px-4 py-2 text-center text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted sm:w-auto">
            {t('clearFilters')}
          </Link>
        )}
      </form>

      <div className="app-surface">
        <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[640px] w-full divide-y divide-border text-sm">
            <thead className="bg-muted/80">
              <tr>
                <th className="px-4 py-3 text-start font-semibold text-foreground">{t('name')}</th>
                <th className="px-4 py-3 text-start font-semibold text-foreground">{t('category')}</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">{t('variations')}</th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">{t('status')}</th>
                <th className="px-4 py-3 text-start font-semibold text-foreground">{t('updated')}</th>
                <th className="px-4 py-3 text-end font-semibold text-foreground">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {filteredRows.map((row: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const vars = (row as any).product_variations as { id: string; stock_quantity: number }[] | null
                const varList = vars ?? []
                const varCount = row.has_variations ? varList.length : 1
                const lowStock = varList.some((v) => Number(v.stock_quantity) < 10)

                return (
                  <tr
                    key={row.id}
                    className={cn('transition-colors hover:bg-muted/40', lowStock && 'bg-amber-50/90')}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.name}
                      {lowStock && (
                        <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                          {t('lowStock')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.category ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{varCount}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                          row.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700',
                        )}
                      >
                        {row.is_active ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(row.updated_at ?? new Date())}</td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={`/supplier/products/${row.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {tCommon('edit')}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {(!filteredRows || filteredRows.length === 0) && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        )}
      </div>

      <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{t('pageOf', { page, pages: totalPages, total })}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/supplier/products${buildQuery(page - 1)}`}
              className="rounded-lg border border-border bg-card px-3 py-2 font-medium text-foreground transition hover:bg-muted"
            >
              {tCommon('previous')}
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/supplier/products${buildQuery(page + 1)}`}
              className="rounded-lg border border-border bg-card px-3 py-2 font-medium text-foreground transition hover:bg-muted"
            >
              {tCommon('next')}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
