'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { parseProductsCsv } from '@/lib/products/csv-import'
import { loadProductCompleteness } from '@/lib/products/load-completeness'
import { applyStockDeltaViaMovement } from '@/lib/services/inventory/apply-stock-delta'
import { getSupplierActionContext, MIN_PUBLISH_COMPLETENESS_SCORE } from '@/lib/supplier/access'
import { isMarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'
import type { ProductCatalogStatus } from '@/lib/types/products'

async function getSupplierContext(requireCatalog = true) {
  const result = await getSupplierActionContext({ requireCatalog })
  if (result.error || !result.ctx) {
    return { error: result.error ?? 'Unauthorized' as const, supplierId: null, supabase: null }
  }
  return { error: null, supplierId: result.ctx.supplierId, supabase: result.ctx.supabase }
}

async function assertOwnProduct(supabase: NonNullable<Awaited<ReturnType<typeof getSupplierContext>>['supabase']>, supplierId: string, productId: string) {
  const { data, error } = await supabase.from('products').select('id').eq('id', productId).eq('supplier_id', supplierId).maybeSingle()
  if (error) return { ok: false as const, error: error.message }
  if (!data) return { ok: false as const, error: 'Product not found' }
  return { ok: true as const }
}

function catalogToActive(status: ProductCatalogStatus): boolean {
  return status === 'published'
}

async function syncPrimaryImage(supabase: NonNullable<Awaited<ReturnType<typeof getSupplierContext>>['supabase']>, productId: string) {
  const { data: images } = await supabase
    .from('product_images')
    .select('url')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)

  const primary = images?.[0]?.url ?? null
  await supabase.from('products').update({ image_url: primary, updated_at: new Date().toISOString() }).eq('id', productId)
}

export async function setProductCatalogStatus(productId: string, status: ProductCatalogStatus) {
  const ctx = await getSupplierContext()
  if (ctx.error || !ctx.supplierId || !ctx.supabase) return { error: ctx.error ?? 'Unauthorized' }

  const own = await assertOwnProduct(ctx.supabase, ctx.supplierId, productId)
  if (!own.ok) return { error: own.error }

  if (status === 'published') {
    const completeness = await loadProductCompleteness(ctx.supabase, productId)
    if (!completeness || completeness.score < MIN_PUBLISH_COMPLETENESS_SCORE) {
      return {
        error: 'PUBLISH_INCOMPLETE',
        missingKeys: completeness?.missingKeys ?? [],
        score: completeness?.score ?? 0,
      }
    }
  }

  const { error } = await ctx.supabase
    .from('products')
    .update({
      catalog_status: status,
      is_active: catalogToActive(status),
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)

  if (error) return { error: error.message }

  revalidatePath('/supplier/products')
  revalidatePath(`/supplier/products/${productId}`)
  return { error: null }
}

export async function duplicateProduct(productId: string) {
  const ctx = await getSupplierContext()
  if (ctx.error || !ctx.supplierId) return { error: ctx.error ?? 'Unauthorized', newProductId: null }

  const { supabase, supplierId } = ctx
  const own = await assertOwnProduct(supabase, supplierId, productId)
  if (!own.ok) return { error: own.error, newProductId: null }

  const { data: source, error: srcErr } = await supabase.from('products').select('*').eq('id', productId).single()
  if (srcErr || !source) return { error: srcErr?.message ?? 'Not found', newProductId: null }

  const { data: newProduct, error: insErr } = await supabase
    .from('products')
    .insert({
      supplier_id: supplierId,
      name: `${source.name} (copy)`,
      description: source.description,
      category: source.category,
      marketplace_category: (source as { marketplace_category?: string | null }).marketplace_category ?? null,
      image_url: source.image_url,
      has_variations: source.has_variations,
      is_active: false,
      catalog_status: 'draft',
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insErr || !newProduct) return { error: insErr?.message ?? 'Duplicate failed', newProductId: null }

  const { data: vars } = await supabase
    .from('product_variations')
    .select(
      'name, sku, cost_price, price, stock_quantity, min_order_quantity, reorder_point, reorder_qty, lead_time_days, is_active',
    )
    .eq('product_id', productId)

  if (vars?.length) {
    const rows = vars.map((v) => ({
      product_id: newProduct.id,
      name: v.name,
      sku: v.sku ? `${v.sku}-copy-${randomUUID().slice(0, 6)}` : null,
      cost_price: v.cost_price ?? 0,
      price: v.price,
      stock_quantity: 0,
      min_order_quantity: v.min_order_quantity,
      reorder_point: (v as { reorder_point?: number | null }).reorder_point ?? null,
      reorder_qty: (v as { reorder_qty?: number | null }).reorder_qty ?? null,
      lead_time_days: (v as { lead_time_days?: number | null }).lead_time_days ?? null,
      is_active: v.is_active,
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('product_variations').insert(rows)
  }

  const { data: images } = await supabase
    .from('product_images')
    .select('url, storage_path, sort_order')
    .eq('product_id', productId)

  if (images?.length) {
    await supabase.from('product_images').insert(
      images.map((img) => ({
        product_id: newProduct.id,
        url: img.url,
        storage_path: img.storage_path,
        sort_order: img.sort_order,
      })),
    )
  }

  revalidatePath('/supplier/products')
  return { error: null, newProductId: newProduct.id }
}

export async function uploadProductGalleryImage(productId: string, formData: FormData) {
  const ctx = await getSupplierContext()
  if (ctx.error || !ctx.supplierId) return { error: ctx.error ?? 'Unauthorized', image: null }

  const own = await assertOwnProduct(ctx.supabase, ctx.supplierId, productId)
  if (!own.ok) return { error: own.error, image: null }

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'No file provided', image: null }

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const imageId = randomUUID()
  const path = `products/${productId}/gallery/${imageId}.${ext}`

  const { error: uploadError } = await ctx.supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: false, contentType: file.type || 'image/jpeg' })

  if (uploadError) return { error: uploadError.message, image: null }

  const { data: publicUrl } = ctx.supabase.storage.from('product-images').getPublicUrl(path)

  const { data: maxSort } = await ctx.supabase
    .from('product_images')
    .select('sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (maxSort?.sort_order ?? -1) + 1

  const { data: image, error: insErr } = await ctx.supabase
    .from('product_images')
    .insert({
      product_id: productId,
      url: publicUrl.publicUrl,
      storage_path: path,
      sort_order: sortOrder,
    })
    .select('id, url, storage_path, sort_order')
    .single()

  if (insErr || !image) return { error: insErr?.message ?? 'Save failed', image: null }

  await syncPrimaryImage(ctx.supabase, productId)

  revalidatePath(`/supplier/products/${productId}`)
  revalidatePath('/supplier/products')
  return {
    error: null,
    image: {
      id: image.id,
      url: image.url,
      storagePath: image.storage_path,
      sortOrder: image.sort_order,
    },
  }
}

export async function deleteProductGalleryImage(productId: string, imageId: string) {
  const ctx = await getSupplierContext()
  if (ctx.error || !ctx.supplierId) return { error: ctx.error ?? 'Unauthorized' }

  const own = await assertOwnProduct(ctx.supabase, ctx.supplierId, productId)
  if (!own.ok) return { error: own.error }

  const { data: image, error: fetchErr } = await ctx.supabase
    .from('product_images')
    .select('id, storage_path')
    .eq('id', imageId)
    .eq('product_id', productId)
    .maybeSingle()

  if (fetchErr || !image) return { error: fetchErr?.message ?? 'Image not found' }

  if (image.storage_path && !image.storage_path.startsWith('legacy/')) {
    await ctx.supabase.storage.from('product-images').remove([image.storage_path])
  }

  const { error } = await ctx.supabase.from('product_images').delete().eq('id', imageId)
  if (error) return { error: error.message }

  await syncPrimaryImage(ctx.supabase, productId)

  revalidatePath(`/supplier/products/${productId}`)
  revalidatePath('/supplier/products')
  return { error: null }
}

export async function setPrimaryGalleryImage(productId: string, imageId: string) {
  const ctx = await getSupplierContext()
  if (ctx.error || !ctx.supplierId) return { error: ctx.error ?? 'Unauthorized' }

  const own = await assertOwnProduct(ctx.supabase, ctx.supplierId, productId)
  if (!own.ok) return { error: own.error }

  const { data: image, error: fetchErr } = await ctx.supabase
    .from('product_images')
    .select('id')
    .eq('id', imageId)
    .eq('product_id', productId)
    .maybeSingle()

  if (fetchErr || !image) return { error: fetchErr?.message ?? 'Image not found' }

  await ctx.supabase.from('product_images').update({ sort_order: 9999 }).eq('product_id', productId)
  await ctx.supabase.from('product_images').update({ sort_order: 0 }).eq('id', imageId)

  const { data: rest } = await ctx.supabase
    .from('product_images')
    .select('id')
    .eq('product_id', productId)
    .neq('id', imageId)
    .order('sort_order', { ascending: true })

  let order = 1
  for (const row of rest ?? []) {
    await ctx.supabase.from('product_images').update({ sort_order: order }).eq('id', row.id)
    order++
  }

  await syncPrimaryImage(ctx.supabase, productId)

  revalidatePath(`/supplier/products/${productId}`)
  revalidatePath('/supplier/products')
  return { error: null }
}

export async function importProductsCsv(csvText: string) {
  const parsed = parseProductsCsv(csvText)
  if (!parsed.ok) return { error: parsed.error, created: 0, updated: 0, skipped: 0 }

  const ctx = await getSupplierContext()
  if (ctx.error || !ctx.supplierId) {
    return { error: ctx.error ?? 'Unauthorized', created: 0, updated: 0, skipped: 0 }
  }

  const { supabase, supplierId } = ctx
  let created = 0
  let updated = 0
  let skipped = 0

  for (const group of parsed.groups) {
    const category =
      group.marketplaceCategory && isMarketplaceCategorySlug(group.marketplaceCategory)
        ? group.marketplaceCategory
        : null

    const { data: existing } = await supabase
      .from('products')
      .select('id, has_variations')
      .eq('supplier_id', supplierId)
      .ilike('name', group.productName)
      .maybeSingle()

    let productId: string

    if (existing) {
      productId = existing.id
      await supabase
        .from('products')
        .update({
          marketplace_category: category,
          has_variations: group.variations.length > 1 || existing.has_variations,
          is_active: group.isActive,
          catalog_status: group.isActive ? 'published' : 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
      updated++
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('products')
        .insert({
          supplier_id: supplierId,
          name: group.productName,
          marketplace_category: category,
          has_variations: group.variations.length > 1,
          is_active: group.isActive,
          catalog_status: group.isActive ? 'published' : 'draft',
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insErr || !inserted) return { error: insErr?.message ?? 'Import failed', created, updated, skipped }
      productId = inserted.id
      created++
    }

    const { data: existingVars } = await supabase
      .from('product_variations')
      .select('id, name, sku, stock_quantity')
      .eq('product_id', productId)

    for (const row of group.variations) {
      let match = existingVars?.find((v) => row.sku && v.sku === row.sku)
      if (!match) match = existingVars?.find((v) => v.name.toLowerCase() === row.variation_name.toLowerCase())

      const moq = row.min_order_quantity
      const reorderPoint = row.reorder_point ?? Math.max(moq * 2, 1)

      if (match) {
        const prevQty = Number(match.stock_quantity)
        await supabase
          .from('product_variations')
          .update({
            name: row.variation_name,
            sku: row.sku,
            cost_price: row.cost_price,
            price: row.price,
            min_order_quantity: moq,
            reorder_point: reorderPoint,
            reorder_qty: row.reorder_qty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', match.id)

        if (row.stock_quantity !== prevQty) {
          const adj = await applyStockDeltaViaMovement(supabase, {
            supplierId,
            variationId: match.id,
            previousQty: prevQty,
            targetQty: row.stock_quantity,
            referenceType: 'csv_import',
            referenceId: match.id,
            notes: 'csv_import',
          })
          if (adj.error) skipped++
        }
      } else {
        const { data: newVar, error: vErr } = await supabase
          .from('product_variations')
          .insert({
            product_id: productId,
            name: row.variation_name,
            sku: row.sku,
            cost_price: row.cost_price,
            price: row.price,
            stock_quantity: 0,
            min_order_quantity: moq,
            reorder_point: reorderPoint,
            reorder_qty: row.reorder_qty,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (vErr || !newVar) {
          skipped++
          continue
        }

        if (row.stock_quantity > 0) {
          const adj = await applyStockDeltaViaMovement(supabase, {
            supplierId,
            variationId: newVar.id,
            previousQty: 0,
            targetQty: row.stock_quantity,
            referenceType: 'csv_import',
            referenceId: newVar.id,
            notes: 'csv_import',
          })
          if (adj.error) skipped++
        }
      }
    }
  }

  revalidatePath('/supplier/products')
  return { error: null, created, updated, skipped }
}
