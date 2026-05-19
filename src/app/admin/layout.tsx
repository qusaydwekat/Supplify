import { requireAdmin } from '@/lib/auth/require-admin'
import { supabaseServer } from '@/lib/supabase/server'
import { AdminShell } from '@/components/layout/admin-shell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  const supabase = supabaseServer()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, business_name')
    .eq('user_id', admin.userId)
    .maybeSingle()

  return (
    <AdminShell userName={profile?.name ?? ''} email={admin.email}>
      {children}
    </AdminShell>
  )
}
