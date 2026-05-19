import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listUsersForAdmin } from '@/lib/data/admin/users'
import { AdminUsersTable } from '@/components/admin/admin-users-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>
}) {
  const t = await getTranslations('Admin')
  const sp = await searchParams
  const { userId } = await requireAdmin()
  const users = await listUsersForAdmin({ q: sp.q, role: sp.role })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('usersTitle')}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('usersSubtitle')}</p>
      </div>

      <form
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[200px] flex-1">
          <label className="form-label" htmlFor="admin-users-q">
            {t('filterSearch')}
          </label>
          <Input
            id="admin-users-q"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder={t('filterUsersPlaceholder')}
            className="mt-1.5"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="form-label" htmlFor="admin-users-role">
            {t('filterRole')}
          </label>
          <select
            id="admin-users-role"
            name="role"
            defaultValue={sp.role ?? 'all'}
            className="mt-1.5 flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">{t('filterRoleAll')}</option>
            <option value="supplier">supplier</option>
            <option value="retailer">retailer</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <Button type="submit">{t('filterApply')}</Button>
        <Link
          href="/admin/users"
          className={cn(
            'inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted',
          )}
        >
          {t('filterClear')}
        </Link>
      </form>

      <p className="text-xs text-muted-foreground">
        {t('filterResultsCount', { count: users.length })}
      </p>

      <AdminUsersTable users={users} currentUserId={userId} />
    </div>
  )
}
