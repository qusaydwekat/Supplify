import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: userRow }, { data: profile }] = await Promise.all([
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
    supabase
      .from('profiles')
      .select('name, business_name')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const role = userRow?.role as string | undefined
  if (role === 'admin') redirect('/admin')

  const dashRole = (role ?? 'retailer') as 'supplier' | 'retailer'

  return (
    <DashboardShell
      role={dashRole}
      userName={profile?.name ?? ''}
      businessName={profile?.business_name ?? ''}
    >
      {children}
    </DashboardShell>
  )
}
