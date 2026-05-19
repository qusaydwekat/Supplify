import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { listSuppliersForAdmin } from '@/lib/data/admin/suppliers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const t = await getTranslations('Admin')
  const sp = await searchParams
  const rows = await listSuppliersForAdmin({ q: sp.q })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('suppliersTitle')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('suppliersSubtitle')}</p>
      </div>

      <form
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="min-w-[200px] flex-1">
          <label className="form-label" htmlFor="sup-q">
            {t('filterSearch')}
          </label>
          <Input id="sup-q" name="q" defaultValue={sp.q ?? ''} placeholder={t('filterSuppliersPlaceholder')} className="mt-1.5" />
        </div>
        <Button type="submit">{t('filterApply')}</Button>
        <Link
          href="/admin/suppliers"
          className={cn(
            'inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted',
          )}
        >
          {t('filterClear')}
        </Link>
      </form>

      <p className="text-xs text-muted-foreground">{t('filterResultsCount', { count: rows.length })}</p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colBusiness')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colName')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colEmail')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colCurrency')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.supplier_id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{r.business_name ?? '—'}</td>
                <td className="px-4 py-3">{r.name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.email ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.currency_code ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
