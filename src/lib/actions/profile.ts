'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { profileSchema } from '@/lib/validations/profile'

export async function updateProfile(input: unknown) {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.message }

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      name: parsed.data.name,
      business_name: parsed.data.business_name,
      phone: parsed.data.phone || null,
      city: parsed.data.city || null,
      tax_id: parsed.data.tax_id?.trim() ? parsed.data.tax_id.trim() : null,
      commercial_registration: parsed.data.commercial_registration?.trim()
        ? parsed.data.commercial_registration.trim()
        : null,
      vat_registered: !!parsed.data.vat_registered,
      prefer_hijri: !!parsed.data.prefer_hijri,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath('/supplier/profile')
  revalidatePath('/retailer/profile')
  return { data, error: null }
}
