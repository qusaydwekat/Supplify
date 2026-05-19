import 'server-only'

import { headers } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'
import type { AppUserRole } from '@/lib/auth/require-admin'

export const AUTH_HEADER_USER_ID = 'x-user-id'
export const AUTH_HEADER_USER_ROLE = 'x-user-role'

function isAppRole(v: string | null): v is AppUserRole {
  return v === 'supplier' || v === 'retailer' || v === 'admin'
}

/**
 * Session resolved in middleware (one auth + role lookup per navigation).
 * Layouts should prefer this over calling auth.getUser() again.
 */
export async function getRequestSession(): Promise<{ userId: string; role: AppUserRole } | null> {
  const hdrs = await headers()
  const userId = hdrs.get(AUTH_HEADER_USER_ID)
  const role = hdrs.get(AUTH_HEADER_USER_ROLE)
  if (userId && isAppRole(role)) {
    return { userId, role }
  }

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: row } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const dbRole = row?.role
  if (!isAppRole(dbRole ?? null)) return null
  return { userId: user.id, role: dbRole }
}
