import { getTranslations } from 'next-intl/server'
import { requireRequestUserId } from '@/lib/auth/request-session'
import { resolveSupplierAccess } from '@/lib/supplier/access'
import { supabaseServer } from '@/lib/supabase/server'

type TeamMemberRow = {
  id: string
  role: 'manager' | 'viewer'
  created_at: string
  user_id: string
  email: string | null
  name: string | null
}

export default async function SupplierTeamPage() {
  const t = await getTranslations('SupplierTeam')
  await requireRequestUserId()
  const access = await resolveSupplierAccess()

  if (!access.access) {
    return <p className="text-sm text-red-600">{t('notSupplier')}</p>
  }

  if (access.access.role !== 'owner') {
    return <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>
  }

  const supabase = supabaseServer()
  const { data: members, error } = await supabase
    .from('supplier_team_members')
    .select('id, role, created_at, user_id')
    .eq('supplier_id', access.access.supplierId)
    .order('created_at', { ascending: true })

  if (error) {
    return <p className="text-sm text-red-600">{t('loadError', { message: error.message })}</p>
  }

  const userIds = (members ?? []).map((m) => m.user_id)
  const [{ data: users }, { data: profiles }] = await Promise.all([
    userIds.length
      ? supabase.from('users').select('id, email').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; email: string }[] }),
    userIds.length
      ? supabase.from('profiles').select('user_id, name').in('user_id', userIds)
      : Promise.resolve({ data: [] as { user_id: string; name: string | null }[] }),
  ])

  const emailById = new Map((users ?? []).map((u) => [u.id, u.email]))
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.name]))

  const rows: TeamMemberRow[] = (members ?? []).map((m) => ({
    id: m.id,
    role: m.role as 'manager' | 'viewer',
    created_at: m.created_at,
    user_id: m.user_id,
    email: emailById.get(m.user_id) ?? null,
    name: nameById.get(m.user_id) ?? null,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-foreground">{t('membersTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('membersHint')}</p>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground sm:px-5">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold sm:px-5">{t('colName')}</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">{t('colEmail')}</th>
                  <th className="px-4 py-3 font-semibold sm:px-5">{t('colRole')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground sm:px-5">{row.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground sm:px-5">{row.email ?? '—'}</td>
                    <td className="px-4 py-3 sm:px-5">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                        {t(`role_${row.role}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
