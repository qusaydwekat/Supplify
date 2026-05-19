'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { applyStockDeltaViaMovement } from '@/lib/services/inventory/apply-stock-delta'
import {
  productCreateSchema,
  productUpdateSchema,
  variationCreateSchema,
  variationUpdateSchema,
  adjustStockSchema,
} from '@/lib/validations/product'

async function getSupplierIdForUser() {
  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, supplierId: null, error: 'Unauthorized' as const }

  const { data: supplier, error } = await supabase
    .from('suppliers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return { supabase, user, supplierId: null, error: error.message }
  if (!supplier) return { supabase, user, supplierId: null, error: 'Supplier record not found' as const }

  return { supabase, user, supplierId: supplier.id, error: null }
}

async function assertOwnProduct(supabase: ReturnType<typeof supabaseServer>, supplierId: string, productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('id, supplier_id')
    .eq('id', productId)
    .maybeSingle()

  if (error) return { ok: false as const, error: error.message }
  if (!data || data.supplier_id !== supplierId) return { ok: false as const, error: 'Product not found' }
  return { ok: true as const, product: data }
}

async function assertOwnVariation(
  supabase: ReturnType<typeof supabaseServer>,
  supplierId: string,
  variationId: string,
) {
  const { data: varRow, error: vErr } = await supabase
    .from('product_variations')
    .select('id, product_id')
    .eq('id', variationId)
    .maybeSingle()

  if (vErr) return { ok: false as const, error: vErr.message }
  if (!varRow) return { ok: false as const, error: 'Variation not found' }

  const { data: prod, error: pErr } = await supabase
    .from('products')
    .select('supplier_id')
    .eq('id', varRow.product_id)
    .maybeSingle()

  if (pErr) return { ok: false as const, error: pErr.message }
  if (!prod || prod.supplier_id !== supplierId) return { ok: false as const, error: 'Variation not found' }

  return { ok: true as const, variationId: varRow.id, productId: varRow.product_id }
}

export async function createProduct(input: unknown) {
  const parsed = productCreateSchema.safeParse(input)
  if (!parsed.success) return { product: null, error: parsed.error.message }

  const ctx = await getSupplierIdForUser()
  if (ctx.error || !ctx.supplierId) return { product: null, error: ctx.error ?? 'Unauthorized' }

  const { supabase, supplierId } = ctx
  const p = parsed.data

  const { data: product, error: insertError } = await supabase
    .from('products')
    .insert({
      supplier_id: supplierId,
      name: p.name,
      description: p.description || null,
      category: p.category || null,
      image_url: p.image_url || null,
      has_variations: p.has_variations,
      is_active: p.is_active,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (insertError || !product) return { product: null, error: insertError?.message ?? 'Insert failed' }

  if (!p.has_variations) {
    const { data: vRow, error: vError } = await supabase
      .from('product_variations')
      .insert({
        product_id: product.id,
        name: 'Default',
        sku: null,
        cost_price: p.cost_price ?? 0,
        price: p.price ?? 0,
        stock_quantity: 0,
        min_order_quantity: p.min_order_quantity ?? 1,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (vError || !vRow) return { product: null, error: vError?.message ?? 'Insert failed' }

    const targetStock = p.stock_quantity ?? 0
    if (targetStock > 0) {
      const adj = await applyStockDeltaViaMovement(supabase, {
        supplierId,
        variationId: vRow.id,
        previousQty: 0,
        targetQty: targetStock,
        referenceType: 'catalog_initial',
        referenceId: vRow.id,
      })
      if (adj.error) return { product: null, error: adj.error }
    }
  } else if (p.variations?.length) {
    const rows = p.variations.map((v) => ({
      product_id: product.id,
      name: v.name,
      sku: v.sku || null,
      cost_price: v.cost_price ?? 0,
      price: v.price,
      stock_quantity: 0,
      min_order_quantity: v.min_order_quantity,
      is_active: v.is_active,
      updated_at: new Date().toISOString(),
    }))
    const { data: insertedVars, error: vError } = await supabase.from('product_variations').insert(rows).select('id')

    if (vError || !insertedVars?.length) return { product: null, error: vError?.message ?? 'Insert failed' }

    for (let i = 0; i < insertedVars.length; i++) {
      const row = insertedVars[i]
      const v = p.variations[i]
      const targetStock = v.stock_quantity
      if (targetStock > 0) {
        const adj = await applyStockDeltaViaMovement(supabase, {
          supplierId,
          variationId: row.id,
          previousQty: 0,
          targetQty: targetStock,
          referenceType: 'catalog_initial',
          referenceId: row.id,
        })
        if (adj.error) return { product: null, error: adj.error }
      }
    }
  }

  revalidatePath('/supplier/products')
  revalidatePath(`/supplier/products/${product.id}`)
  return { product, error: null }
}

export async function updateProduct(id: string, input: unknown) {
  const parsed = productUpdateSchema.safeParse(input)
  if (!parsed.success) return { product: null, error: parsed.error.message }

  const ctx = await getSupplierIdForUser()
  if (ctx.error || !ctx.supplierId) return { product: null, error: ctx.error ?? 'Unauthorized' }

  const { supabase, supplierId } = ctx
  const own = await assertOwnProduct(supabase, supplierId, id)
  if (!own.ok) return { product: null, error: own.error }

  const p = parsed.data
  const { data: product, error } = await supabase
    .from('products')
    .update({
      name: p.name,
      description: p.description || null,
      category: p.category || null,
      image_url: p.image_url || null,
      has_variations: p.has_variations,
      is_active: p.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return { product: null, error: error.message }

  revalidatePath('/supplier/products')
  revalidatePath(`/supplier/products/${id}`)
  revalidatePath(`/supplier/products/${id}/variations`)
  return { product, error: null }
}

export async function deleteProduct(id: string) {
  const ctx = await getSupplierIdForUser()
  if (ctx.error || !ctx.supplierId) return { error: ctx.error ?? 'Unauthorized' }

  const { supabase, supplierId } = ctx
  const own = await assertOwnProduct(supabase, supplierId, id)
  if (!own.ok) return { error: own.error }

  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/supplier/products')
  return { error: null }
}

export async function createVariation(productId: string, data: unknown) {
  const parsed = variationCreateSchema.safeParse(data)
  if (!parsed.success) return { variation: null, error: parsed.error.message }

  const ctx = await getSupplierIdForUser()
  if (ctx.error || !ctx.supplierId) return { variation: null, error: ctx.error ?? 'Unauthorized' }

  const { supabase, supplierId } = ctx
  const own = await assertOwnProduct(supabase, supplierId, productId)
  if (!own.ok) return { variation: null, error: own.error }

  const v = parsed.data
  const { data: variation, error } = await supabase
    .from('product_variations')
    .insert({
      product_id: productId,
      name: v.name,
      sku: v.sku || null,
      cost_price: v.cost_price ?? 0,
      price: v.price,
      stock_quantity: 0,
      min_order_quantity: v.min_order_quantity,
      is_active: v.is_active,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !variation) return { variation: null, error: error?.message ?? 'Insert failed' }

  if (v.stock_quantity > 0) {
    const adj = await applyStockDeltaViaMovement(supabase, {
      supplierId,
      variationId: variation.id,
      previousQty: 0,
      targetQty: v.stock_quantity,
      referenceType: 'catalog_initial',
      referenceId: variation.id,
    })
    if (adj.error) return { variation: null, error: adj.error }
  }

  const { data: variationOut, error: fetchErr } = await supabase
    .from('product_variations')
    .select()
    .eq('id', variation.id)
    .single()

  if (fetchErr || !variationOut) return { variation: null, error: fetchErr?.message ?? 'Failed to load variation' }

  revalidatePath(`/supplier/products/${productId}`)
  revalidatePath(`/supplier/products/${productId}/variations`)
  revalidatePath('/supplier/products')
  return { variation: variationOut, error: null }
}

export async function updateVariation(id: string, data: unknown) {
  const body =
    typeof data === 'object' && data !== null ? { ...(data as Record<string, unknown>), id } : { id }
  const parsed = variationUpdateSchema.safeParse(body)
  if (!parsed.success) return { variation: null, error: parsed.error.message }

  const ctx = await getSupplierIdForUser()
  if (ctx.error || !ctx.supplierId) return { variation: null, error: ctx.error ?? 'Unauthorized' }

  const { supabase, supplierId } = ctx
  const check = await assertOwnVariation(supabase, supplierId, id)
  if (!check.ok) return { variation: null, error: check.error }

  const v = parsed.data

  const { data: prevRow, error: prevErr } = await supabase
    .from('product_variations')
    .select('stock_quantity')
    .eq('id', id)
    .maybeSingle()

  if (prevErr || prevRow == null) return { variation: null, error: prevErr?.message ?? 'Not found' }

  const prevQty = Number(prevRow.stock_quantity)

  const { error } = await supabase
    .from('product_variations')
    .update({
      name: v.name,
      sku: v.sku || null,
      cost_price: v.cost_price ?? 0,
      price: v.price,
      min_order_quantity: v.min_order_quantity,
      is_active: v.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { variation: null, error: error.message }

  if (prevQty !== v.stock_quantity) {
    const adj = await applyStockDeltaViaMovement(supabase, {
      supplierId,
      variationId: id,
      previousQty: prevQty,
      targetQty: v.stock_quantity,
      referenceType: 'catalog_edit',
      referenceId: id,
    })
    if (adj.error) return { variation: null, error: adj.error }
  }

  const { data: variationFinal, error: refErr } = await supabase
    .from('product_variations')
    .select()
    .eq('id', id)
    .single()

  if (refErr || !variationFinal) return { variation: null, error: refErr?.message ?? 'Failed to load variation' }

  revalidatePath(`/supplier/products/${check.productId}`)
  revalidatePath(`/supplier/products/${check.productId}/variations`)
  revalidatePath('/supplier/products')
  return { variation: variationFinal, error: null }
}

export async function deleteVariation(variationId: string) {
  const ctx = await getSupplierIdForUser()
  if (ctx.error || !ctx.supplierId) return { error: ctx.error ?? 'Unauthorized' }

  const { supabase, supplierId } = ctx
  const check = await assertOwnVariation(supabase, supplierId, variationId)
  if (!check.ok) return { error: check.error }

  const { error } = await supabase.from('product_variations').delete().eq('id', variationId)
  if (error) return { error: error.message }

  revalidatePath(`/supplier/products/${check.productId}`)
  revalidatePath(`/supplier/products/${check.productId}/variations`)
  revalidatePath('/supplier/products')
  return { error: null }
}

export async function adjustStock(variationId: string, quantity: number, reason?: string) {
  const parsed = adjustStockSchema.safeParse({ variationId, delta: quantity, reason })
  if (!parsed.success) return { error: parsed.error.message }

  const ctx = await getSupplierIdForUser()
  if (ctx.error || !ctx.supplierId) return { error: ctx.error ?? 'Unauthorized' }

  const { supabase, supplierId } = ctx
  const check = await assertOwnVariation(supabase, supplierId, parsed.data.variationId)
  if (!check.ok) return { error: check.error }

  const { data: current, error: fetchError } = await supabase
    .from('product_variations')
    .select('stock_quantity')
    .eq('id', parsed.data.variationId)
    .single()

  if (fetchError || current == null) return { error: fetchError?.message ?? 'Not found' }

  const prev = Number(current.stock_quantity)
  const next = prev + parsed.data.delta
  if (next < 0) return { error: 'Stock cannot be negative' }

  const adj = await applyStockDeltaViaMovement(supabase, {
    supplierId,
    variationId: parsed.data.variationId,
    previousQty: prev,
    targetQty: next,
    referenceType: 'manual_adjustment',
    referenceId: randomUUID(),
    notes: parsed.data.reason?.trim() || null,
  })

  if (adj.error) return { error: adj.error }

  revalidatePath(`/supplier/products/${check.productId}`)
  revalidatePath(`/supplier/products/${check.productId}/variations`)
  revalidatePath('/supplier/products')
  return { error: null }
}

export async function uploadProductImage(productId: string, formData: FormData) {
  const ctx = await getSupplierIdForUser()
  if (ctx.error || !ctx.supplierId) return { data: null, error: ctx.error ?? 'Unauthorized' }

  const { supabase, supplierId } = ctx
  const own = await assertOwnProduct(supabase, supplierId, productId)
  if (!own.ok) return { data: null, error: own.error }

  const file = formData.get('file')
  if (!(file instanceof File)) return { data: null, error: 'No file provided' }

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
  const path = `products/${productId}/image.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })

  if (uploadError) return { data: null, error: uploadError.message }

  const { data: publicUrl } = supabase.storage.from('product-images').getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('products')
    .update({ image_url: publicUrl.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', productId)

  if (updateError) return { data: null, error: updateError.message }

  revalidatePath('/supplier/products')
  revalidatePath(`/supplier/products/${productId}`)
  return { data: { image_url: publicUrl.publicUrl }, error: null }
}
