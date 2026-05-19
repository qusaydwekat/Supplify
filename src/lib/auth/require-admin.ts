import 'server-only'

import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

export type AppUserRole = 'supplier' | 'retailer' | 'admin'

export async function getSessionRole(): Promise<{ userId: string; role: AppUserRole } | null> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: row } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = (row?.role as AppUserRole | undefined) ?? null
  if (!role) return null
  return { userId: user.id, role }
}

/** Signed-out → /login; non-admin → supplier or retailer dashboard. */
export async function requireAdmin() {
  const session = await getSessionRole()
  if (!session) redirect('/login')
  if (session.role !== 'admin') {
    redirect(session.role === 'supplier' ? '/supplier' : '/retailer')
  }

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { userId: session.userId, email: user?.email ?? null }
}
