import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { getRequestSession } from '@/lib/auth/request-session'
import { getSupplierNavBadges } from '@/lib/data/supplier-sidebar-badges'
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
  const supplierBadges = dashRole === 'supplier' ? await getSupplierNavBadges() : null

  return (
    <DashboardShell
      role={dashRole}
      userName={profile?.name ?? ''}
      businessName={profile?.business_name ?? ''}
      supplierBadges={supplierBadges}
    >
      {children}
    </DashboardShell>
  )
}
