'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { adminSetUserRole } from '@/lib/actions/admin/users'
import type { AdminUserRow } from '@/lib/data/admin/users'
import { cn } from '@/lib/utils'

const ROLES = ['supplier', 'retailer', 'admin'] as const

type Props = {
  users: AdminUserRow[]
  currentUserId: string
}

export function AdminUsersTable({ users, currentUserId }: Props) {
  const t = useTranslations('Admin')
  const router = useRouter()
  const [pending, start] = useTransition()

  function onRoleChange(userId: string, role: string) {
    start(async () => {
      const res = await adminSetUserRole({ userId, role })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t('roleUpdated'))
      router.refresh()
    })
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colEmail')}</th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colBusiness')}</th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colName')}</th>
            <th className="px-4 py-3 text-start font-medium text-muted-foreground">{t('colRole')}</th>
            <th className="hidden px-4 py-3 text-start font-medium text-muted-foreground sm:table-cell">
              {t('colJoined')}
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-0">
              <td className="max-w-[200px] truncate px-4 py-3 font-medium">{u.email ?? '—'}</td>
              <td className="max-w-[160px] truncate px-4 py-3 text-muted-foreground">{u.business_name ?? '—'}</td>
              <td className="max-w-[140px] truncate px-4 py-3">{u.name ?? '—'}</td>
              <td className="px-4 py-3">
                <select
                  className={cn(
                    'h-10 max-w-[160px] rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    pending && 'pointer-events-none opacity-60',
                  )}
                  value={u.role}
                  disabled={pending}
                  aria-label={t('colRole')}
                  onChange={(e) => onRoleChange(u.id, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option
                      key={r}
                      value={r}
                      disabled={u.id === currentUserId && u.role === 'admin' && r !== 'admin'}
                    >
                      {r}
                    </option>
                  ))}
                </select>
                {u.id === currentUserId && u.role === 'admin' ? (
                  <p className="mt-1 text-xs text-muted-foreground">{t('cannotDemoteSelf')}</p>
                ) : null}
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
