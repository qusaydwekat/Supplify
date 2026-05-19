import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { getRequestSession } from '@/lib/auth/request-session'
import { supabaseServer } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getRequestSession()
  if (!session) redirect('/login')

  if (session.role === 'admin') redirect('/admin')

  const supabase = supabaseServer()
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, business_name')
    .eq('user_id', session.userId)
    .maybeSingle()

  const dashRole = session.role === 'supplier' ? 'supplier' : 'retailer'

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
