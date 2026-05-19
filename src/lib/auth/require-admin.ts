import 'server-only'

import { redirect } from 'next/navigation'
import { getRequestSession } from '@/lib/auth/request-session'
import { supabaseServer } from '@/lib/supabase/server'

export type AppUserRole = 'supplier' | 'retailer' | 'admin'

/** Prefer middleware-backed session; falls back to Supabase when headers are absent. */
export async function getSessionRole(): Promise<{ userId: string; role: AppUserRole } | null> {
  return getRequestSession()
}

/** Signed-out → /login; non-admin → supplier or retailer dashboard. */
export async function requireAdmin() {
  const session = await getRequestSession()
  if (!session) redirect('/login')
  if (session.role !== 'admin') {
    redirect(session.role === 'supplier' ? '/supplier' : '/retailer')
  }

  const supabase = supabaseServer()
  const { data: row } = await supabase.from('users').select('email').eq('id', session.userId).maybeSingle()

  return { userId: session.userId, email: row?.email ?? null }
}
