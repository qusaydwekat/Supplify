'use server'

import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { loadCurrencyConversionState } from '@/lib/currency'
import { supplierProfileSchema } from '@/lib/validations/supplier'

function imageMimeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    default:
      return 'image/jpeg'
  }
}

export async function updateSupplierProfile(input: unknown) {
  const parsed = supplierProfileSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.message }

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Unauthorized' }

  const conv = await loadCurrencyConversionState(supabase)
  if ('error' in conv) return { data: null, error: conv.error }
  if (conv.toDefault.get(parsed.data.currency_code) == null) {
    return { data: null, error: 'No exchange rate is configured for this currency. Add it in currency_rates first.' }
  }

  const { data, error } = await supabase
    .from('suppliers')
    .update({
      description: parsed.data.description || null,
      delivery_areas: parsed.data.delivery_areas,
      logo_url: parsed.data.logo_url || null,
      is_active: parsed.data.is_active,
      currency_code: parsed.data.currency_code,
      marketplace_categories: parsed.data.marketplace_categories,
    })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath('/supplier/profile')
  revalidatePath('/retailer/browse')
  revalidatePath('/retailer/search')
  return { data, error: null }
}

export async function uploadSupplierLogo(formData: FormData) {
  try {
    const supabase = supabaseServer()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Unauthorized' }

    const file = formData.get('file')
    if (!(file instanceof File)) return { data: null, error: 'No file provided' }

    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (supplierError || !supplier) {
      return { data: null, error: supplierError?.message ?? 'Supplier record not found' }
    }

    const ext = file.name.includes('.') ? file.name.split('.').pop()! : 'png'
    const path = `${supplier.id}/logo.${ext}`
    const contentType = file.type || imageMimeFromExt(ext)

    const { error: uploadError } = await supabase.storage
      .from('supplier-logos')
      .upload(path, file, { upsert: true, contentType })

    if (uploadError) return { data: null, error: uploadError.message }

    const { data: publicUrl } = supabase.storage.from('supplier-logos').getPublicUrl(path)

    const { error: updateError } = await supabase
      .from('suppliers')
      .update({ logo_url: publicUrl.publicUrl })
      .eq('id', supplier.id)

    if (updateError) return { data: null, error: updateError.message }

    revalidatePath('/supplier/profile')
    return { data: { logo_url: publicUrl.publicUrl }, error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed'
    return { data: null, error: message }
  }
}
