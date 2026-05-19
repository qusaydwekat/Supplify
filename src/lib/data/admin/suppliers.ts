import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

export type AdminSupplierRow = {
  supplier_id: string
  user_id: string
  email: string | null
  business_name: string | null
  name: string | null
  currency_code: string | null
}

export type AdminSupplierListFilters = {
  q?: string | null
}

export async function listSuppliersForAdmin(filters: AdminSupplierListFilters = {}): Promise<AdminSupplierRow[]> {
  await requireAdmin()
  const db = supabaseServer()

  const term = filters.q?.trim()
  let supplierUserIds: string[] | null = null

  if (term) {
    const like = `%${term}%`
    const [{ data: emailHits }, { data: profHits }] = await Promise.all([
      db.from('users').select('id').ilike('email', like),
      db.from('profiles').select('user_id').or(`business_name.ilike.${like},name.ilike.${like}`),
    ])
    const ids = new Set<string>()
    for (const r of emailHits ?? []) ids.add(r.id as string)
    for (const r of profHits ?? []) ids.add(r.user_id as string)
    supplierUserIds = [...ids]
    if (supplierUserIds.length === 0) return []
  }

  let sq = db.from('suppliers').select('id, user_id, currency_code').order('id', { ascending: true })
  if (supplierUserIds) sq = sq.in('user_id', supplierUserIds)

  const { data: suppliers, error } = await sq

  if (error || !suppliers?.length) return []

  const userIds = suppliers.map((s) => s.user_id as string)
  const { data: users } = await db.from('users').select('id, email').in('id', userIds)
  const { data: profiles } = await db.from('profiles').select('user_id, business_name, name').in('user_id', userIds)

  const userById = new Map((users ?? []).map((u) => [u.id as string, u]))
  const profByUser = new Map((profiles ?? []).map((p) => [p.user_id as string, p]))

  return suppliers.map((s) => {
    const uid = s.user_id as string
    const u = userById.get(uid)
    const p = profByUser.get(uid)
    return {
      supplier_id: s.id as string,
      user_id: uid,
      email: (u?.email as string | null) ?? null,
      business_name: p?.business_name ?? null,
      name: p?.name ?? null,
      currency_code: (s as { currency_code?: string }).currency_code ?? null,
    }
  })
}
