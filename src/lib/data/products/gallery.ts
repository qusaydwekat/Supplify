import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'

export type ProductImageRow = {
  id: string
  url: string
  storagePath: string
  sortOrder: number
}

export async function listProductImages(productId: string): Promise<{ rows: ProductImageRow[]; error?: string }> {
  const supabase = supabaseServer()
  const { data, error } = await supabase
    .from('product_images')
    .select('id, url, storage_path, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { rows: [], error: error.message }

  return {
    rows: (data ?? []).map((r) => ({
      id: r.id,
      url: r.url,
      storagePath: r.storage_path,
      sortOrder: r.sort_order,
    })),
  }
}
