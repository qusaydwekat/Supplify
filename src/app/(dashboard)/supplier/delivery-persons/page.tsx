import { getTranslations } from 'next-intl/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { DeliveryPersonRow } from '@/lib/actions/delivery-persons'
import { DeliveryPersonsManagement } from '@/components/delivery/delivery-persons-management'

export default async function SupplierDeliveryPersonsPage() {
  const t = await getTranslations('DeliveryPersonsPage')
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return <p className="text-sm text-red-600">{t('unauthorized')}</p>

  const { data: supplier } = await supabase.from('suppliers').select('id').eq('user_id', user.id).maybeSingle()
  if (!supplier) return <p className="text-sm text-red-600">{t('notSupplier')}</p>

  const { data: rows } = await supabase
    .from('delivery_persons')
    .select('*')
    .eq('supplier_id', supplier.id)
    .order('name', { ascending: true })

  return <DeliveryPersonsManagement initialRows={(rows ?? []) as DeliveryPersonRow[]} />
}
