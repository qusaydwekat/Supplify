'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'

function revalidateDashboards() {
  revalidatePath('/supplier')
  revalidatePath('/retailer')
}

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Errors.unauthorized' }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Errors.generic' }
  revalidateDashboards()
  return { error: null }
}

export async function markAllNotificationsRead(): Promise<{ error: string | null }> {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Errors.unauthorized' }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) return { error: 'Errors.generic' }
  revalidateDashboards()
  return { error: null }
}
