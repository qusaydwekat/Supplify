import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

export type AdminRetailerRow = {
  user_id: string
  email: string | null
  business_name: string | null
  name: string | null
  city: string | null
  created_at: string
}

export type AdminRetailerListFilters = {
  q?: string | null
}

export async function listRetailersForAdmin(filters: AdminRetailerListFilters = {}): Promise<AdminRetailerRow[]> {
  await requireAdmin()
  const db = supabaseServer()

  const term = filters.q?.trim()
  let matchIds: string[] | null = null

  if (term) {
    const like = `%${term}%`
    const [{ data: emailHits }, { data: profHits }] = await Promise.all([
      db.from('users').select('id').eq('role', 'retailer').ilike('email', like),
      db
        .from('profiles')
        .select('user_id')
        .or(`business_name.ilike.${like},name.ilike.${like},city.ilike.${like}`),
    ])
    const ids = new Set<string>()
    for (const r of emailHits ?? []) ids.add(r.id as string)
    for (const r of profHits ?? []) ids.add(r.user_id as string)
    matchIds = [...ids]
    if (matchIds.length === 0) return []
  }

  let rq = db.from('users').select('id, email, created_at').eq('role', 'retailer').order('created_at', { ascending: false })
  if (matchIds) rq = rq.in('id', matchIds)

  const { data: rows, error } = await rq

  if (error || !rows?.length) return []

  const ids = rows.map((r) => r.id as string)
  const { data: profiles } = await db
    .from('profiles')
    .select('user_id, business_name, name, city')
    .in('user_id', ids)

  const profByUser = new Map((profiles ?? []).map((p) => [p.user_id as string, p]))

  return rows.map((r) => {
    const p = profByUser.get(r.id as string)
    return {
      user_id: r.id as string,
      email: (r.email as string | null) ?? null,
      business_name: p?.business_name ?? null,
      name: p?.name ?? null,
      city: p?.city ?? null,
      created_at: r.created_at as string,
    }
  })
}
