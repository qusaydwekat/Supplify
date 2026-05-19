import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

export type AdminUserRow = {
  id: string
  email: string | null
  role: string
  created_at: string
  business_name: string | null
  name: string | null
  phone: string | null
}

export type AdminUserListFilters = {
  q?: string | null
  role?: string | null
}

export async function listUsersForAdmin(filters: AdminUserListFilters = {}): Promise<AdminUserRow[]> {
  await requireAdmin()
  const db = supabaseServer()

  const roleFilter = filters.role?.trim()
  const term = filters.q?.trim()

  let userIds: string[] | null = null

  if (term) {
    const like = `%${term}%`
    const [{ data: emailHits }, { data: profileHits }] = await Promise.all([
      db.from('users').select('id').ilike('email', like),
      db
        .from('profiles')
        .select('user_id')
        .or(`name.ilike.${like},business_name.ilike.${like},phone.ilike.${like}`),
    ])
    const ids = new Set<string>()
    for (const r of emailHits ?? []) ids.add(r.id as string)
    for (const r of profileHits ?? []) ids.add(r.user_id as string)
    userIds = [...ids]
    if (userIds.length === 0) return []
  }

  let q = db.from('users').select('id, email, role, created_at').order('created_at', { ascending: false })

  if (userIds) q = q.in('id', userIds)
  if (roleFilter && roleFilter !== 'all') q = q.eq('role', roleFilter)

  const { data: users, error } = await q

  if (error || !users?.length) return []

  const ids = users.map((u) => u.id as string)
  const { data: profiles } = await db.from('profiles').select('user_id, business_name, name, phone').in('user_id', ids)

  const profByUser = new Map((profiles ?? []).map((p) => [p.user_id as string, p]))

  return users.map((u) => {
    const p = profByUser.get(u.id as string)
    return {
      id: u.id as string,
      email: (u.email as string | null) ?? null,
      role: String(u.role),
      created_at: u.created_at as string,
      business_name: p?.business_name ?? null,
      name: p?.name ?? null,
      phone: p?.phone ?? null,
    }
  })
}
