import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { listRetailersForAdmin } from '@/lib/data/admin/retailers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default async function AdminRetailersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const t = await getTranslations('Admin')
  const sp = await searchParams
  const rows = await listRetailersForAdmin({ q: sp.q })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('retailersTitle')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('retailersSubtitle')}</p>
      </div>

      <form
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="min-w-[200px] flex-1">
          <label className="form-label" htmlFor="ret-q">
            {t('filterSearch')}
          </label>
          <Input id="ret-q" name="q" defaultValue={sp.q ?? ''} placeholder={t('filterRetailersPlaceholder')} className="mt-1.5" />
        </div>
        <Button type="submit">{t('filterApply')}</Button>
        <Link
          href="/admin/retailers"
          className={cn(
            'inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted',
          )}
        >
          {t('filterClear')}
        </Link>
      </form>

      <p className="text-xs text-muted-foreground">{t('filterResultsCount', { count: rows.length })}</p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colBusiness')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colName')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colEmail')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colCity')}</th>
              <th className="hidden px-4 py-3 text-start font-medium text-muted-foreground sm:table-cell">
                {t('colJoined')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{r.business_name ?? '—'}</td>
                <td className="px-4 py-3">{r.name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.email ?? '—'}</td>
                <td className="px-4 py-3">{r.city ?? '—'}</td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
