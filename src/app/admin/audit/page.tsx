import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { listAuditLogForAdmin } from '@/lib/data/admin/audit-log'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const t = await getTranslations('Admin')
  const sp = await searchParams
  const rows = await listAuditLogForAdmin({ limit: 250, q: sp.q })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('auditTitle')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('auditSubtitle')}</p>
      </div>

      <form
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-end"
      >
        <div className="min-w-[200px] flex-1">
          <label className="form-label" htmlFor="audit-q">
            {t('filterAuditEvent')}
          </label>
          <Input id="audit-q" name="q" defaultValue={sp.q ?? ''} placeholder={t('filterAuditPlaceholder')} className="mt-1.5" />
        </div>
        <Button type="submit">{t('filterApply')}</Button>
        <Link
          href="/admin/audit"
          className={cn(
            'inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted',
          )}
        >
          {t('filterClear')}
        </Link>
      </form>

      <p className="text-xs text-muted-foreground">{t('filterResultsCount', { count: rows.length })}</p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colTime')}</th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colEvent')}</th>
              <th className="hidden px-4 py-3 text-start font-medium text-muted-foreground md:table-cell">
                {t('colOrder')}
              </th>
              <th className="hidden px-4 py-3 text-start font-medium text-muted-foreground lg:table-cell">
                {t('colActor')}
              </th>
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colMeta')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.event_type}</td>
                <td className="hidden max-w-[120px] truncate px-4 py-3 font-mono text-xs md:table-cell">
                  {r.order_id}
                </td>
                <td className="hidden max-w-[120px] truncate px-4 py-3 font-mono text-xs lg:table-cell">
                  {r.actor_id}
                </td>
                <td className="max-w-[min(28rem,50vw)] truncate px-4 py-3 text-xs text-muted-foreground">
                  {JSON.stringify(r.metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
