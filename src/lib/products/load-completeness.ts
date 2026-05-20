import 'server-only'

import { calcProductCompleteness, type CompletenessResult } from '@/lib/products/completeness'
import type { ProductCatalogStatus } from '@/lib/types/products'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function loadProductCompleteness(
  supabase: SupabaseClient,
  productId: string,
): Promise<CompletenessResult | null> {
  const { data: product, error } = await supabase
    .from('products')
    .select('name, description, marketplace_category, image_url, catalog_status, is_active')
    .eq('id', productId)
    .maybeSingle()

  if (error || !product) return null

  const [{ count: galleryCount }, { data: variations }] = await Promise.all([
    supabase.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', productId),
    supabase
      .from('product_variations')
      .select('sku, price, stock_quantity, is_active')
      .eq('product_id', productId),
  ])

  const catalogStatus = ((product as { catalog_status?: ProductCatalogStatus }).catalog_status ??
    (product.is_active ? 'published' : 'draft')) as ProductCatalogStatus

  return calcProductCompleteness({
    name: product.name,
    description: product.description,
    marketplaceCategory: (product as { marketplace_category?: string | null }).marketplace_category ?? null,
    imageUrl: product.image_url,
    galleryCount: galleryCount ?? 0,
    catalogStatus,
    variations: (variations ?? []).map((v) => ({
      sku: v.sku,
      price: Number(v.price),
      stock_quantity: Number(v.stock_quantity),
      is_active: v.is_active ?? true,
    })),
  })
}
