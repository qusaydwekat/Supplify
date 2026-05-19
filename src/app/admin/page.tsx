import { getAdminDashboardSnapshot } from '@/lib/data/admin/dashboard'
import { AdminDashboardView } from '@/components/admin/admin-dashboard-view'

export default async function AdminHomePage() {
  const data = await getAdminDashboardSnapshot()

  return <AdminDashboardView data={data} />
}
