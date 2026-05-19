'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'

const ROLES = ['supplier', 'retailer', 'admin'] as const

export async function adminSetUserRole(input: unknown): Promise<{ error: string | null }> {
  const parsed = input as { userId?: string; role?: string }
  const userId = parsed.userId?.trim()
  const role = parsed.role?.trim()
  if (!userId || !role || !ROLES.includes(role as (typeof ROLES)[number])) {
    return { error: 'Invalid user or role' }
  }

  await requireAdmin()

  const db = supabaseServer()

  const { data: targetRow } = await db.from('users').select('role').eq('id', userId).maybeSingle()

  if (targetRow?.role === 'admin' && role !== 'admin') {
    const { count, error: cntErr } = await db.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin')
    if (cntErr) return { error: cntErr.message }
    if ((count ?? 0) <= 1) return { error: 'Cannot remove the last platform administrator.' }
  }

  const { error } = await db.from('users').update({ role }).eq('id', userId)
  if (error) return { error: error.message }

  if (role === 'supplier') {
    const { data: existing } = await db.from('suppliers').select('id').eq('user_id', userId).maybeSingle()
    if (!existing) {
      const ins = await db.from('suppliers').insert({ user_id: userId })
      if (ins.error) return { error: ins.error.message }
    }
  }

  revalidatePath('/admin')
  revalidatePath('/admin/users')
  revalidatePath('/supplier')
  revalidatePath('/retailer')
  return { error: null }
}
