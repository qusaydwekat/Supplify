import 'server-only'

import { calcProductCompleteness } from '@/lib/products/completeness'
import { MIN_PUBLISH_COMPLETENESS_SCORE, resolveSupplierAccess } from '@/lib/supplier/access'
import { supabaseServer } from '@/lib/supabase/server'
import type { ProductCatalogStatus } from '@/lib/types/products'

export async function countIncompleteCatalogProducts(): Promise<number> {
  const resolved = await resolveSupplierAccess()
  if (!resolved.access) return 0

  const supabase = supabaseServer()
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, description, marketplace_category, image_url, catalog_status, is_active')
    .eq('supplier_id', resolved.access.supplierId)
    .neq('catalog_status', 'archived')

  if (error || !products?.length) return 0

  const ids = products.map((p) => p.id)
  const [{ data: variations }, { data: images }] = await Promise.all([
    supabase.from('product_variations').select('product_id, sku, price, stock_quantity, is_active').in('product_id', ids),
    supabase.from('product_images').select('product_id').in('product_id', ids),
  ])

  const galleryCounts = new Map<string, number>()
  for (const img of images ?? []) {
    galleryCounts.set(img.product_id, (galleryCounts.get(img.product_id) ?? 0) + 1)
  }

  const varsByProduct = new Map<string, typeof variations>()
  for (const v of variations ?? []) {
    const list = varsByProduct.get(v.product_id) ?? []
    list.push(v)
    varsByProduct.set(v.product_id, list)
  }

  let incomplete = 0
  for (const product of products) {
    const catalogStatus = ((product as { catalog_status?: ProductCatalogStatus }).catalog_status ??
      (product.is_active ? 'published' : 'draft')) as ProductCatalogStatus

    const { score } = calcProductCompleteness({
      name: product.name,
      description: product.description,
      marketplaceCategory: (product as { marketplace_category?: string | null }).marketplace_category ?? null,
      imageUrl: product.image_url,
      galleryCount: galleryCounts.get(product.id) ?? 0,
      catalogStatus,
      variations: (varsByProduct.get(product.id) ?? []).map((v) => ({
        sku: v.sku,
        price: Number(v.price),
        stock_quantity: Number(v.stock_quantity),
        is_active: v.is_active ?? true,
      })),
    })

    if (score < MIN_PUBLISH_COMPLETENESS_SCORE) incomplete++
  }

  return incomplete
}
