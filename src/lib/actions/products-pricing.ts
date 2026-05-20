'use server'

import { revalidatePath } from 'next/cache'
import { getSupplierActionContext } from '@/lib/supplier/access'
import type { PriceTier } from '@/lib/pricing/resolve-unit-price'

function defaultReorderPoint(minOrderQty: number, explicit?: number | null) {
  if (explicit != null) return explicit
  return Math.max(minOrderQty * 2, 1)
}

function variationInsertRow(productId: string, v: {
  name: string
  sku?: string | null
  cost_price?: number
  price: number
  min_order_quantity: number
  reorder_point?: number | null
  is_active: boolean
}) {
  const moq = v.min_order_quantity
  return {
    product_id: productId,
    name: v.name,
    sku: v.sku || null,
    cost_price: v.cost_price ?? 0,
    price: v.price,
    stock_quantity: 0,
    min_order_quantity: moq,
    reorder_point: defaultReorderPoint(moq, v.reorder_point),
    reorder_qty: null,
    lead_time_days: null,
    is_active: v.is_active,
    updated_at: new Date().toISOString(),
  }
}

async function getSupplierContext() {
  const result = await getSupplierActionContext({ requireCatalog: true })
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

async function assertOwnVariation(supabase: NonNullable<Awaited<ReturnType<typeof getSupplierContext>>['supabase']>, supplierId: string, variationId: string) {
  const { data: v, error } = await supabase
    .from('product_variations')
    .select('id, product_id')
    .eq('id', variationId)
    .maybeSingle()
  if (error || !v) return { ok: false as const, error: error?.message ?? 'Variation not found', productId: null }

  const own = await assertOwnProduct(supabase, supplierId, v.product_id)
  if (!own.ok) return { ok: false as const, error: own.error, productId: null }
  return { ok: true as const, productId: v.product_id }
}

export async function saveVariationPriceTiers(variationId: string, tiers: PriceTier[]) {
  const ctx = await getSupplierContext()
  if (ctx.error || !ctx.supplierId || !ctx.supabase) return { error: ctx.error ?? 'Unauthorized' }

  const check = await assertOwnVariation(ctx.supabase, ctx.supplierId, variationId)
  if (!check.ok || !check.productId) return { error: check.error }

  const cleaned = tiers
    .map((t) => ({ min_quantity: Math.trunc(t.minQuantity), unit_price: Number(t.unitPrice) }))
    .filter((t) => t.min_quantity >= 1 && Number.isFinite(t.unit_price) && t.unit_price >= 0)
    .sort((a, b) => a.min_quantity - b.min_quantity)

  const seen = new Set<number>()
  for (const t of cleaned) {
    if (seen.has(t.min_quantity)) return { error: 'Duplicate tier quantities' }
    seen.add(t.min_quantity)
  }

  await ctx.supabase.from('variation_price_tiers').delete().eq('variation_id', variationId)

  if (cleaned.length) {
    const { error } = await ctx.supabase.from('variation_price_tiers').insert(
      cleaned.map((t) => ({
        variation_id: variationId,
        min_quantity: t.min_quantity,
        unit_price: t.unit_price,
      })),
    )
    if (error) return { error: error.message }
  }

  revalidatePath(`/supplier/products/${check.productId}`)
  revalidatePath('/supplier/products')
  return { error: null }
}

export type AttributeInput = {
  name: string
  options: string[]
}

export async function saveProductAttributeMatrix(productId: string, attributes: AttributeInput[]) {
  const ctx = await getSupplierContext()
  if (ctx.error || !ctx.supplierId || !ctx.supabase) return { error: ctx.error ?? 'Unauthorized' }

  const own = await assertOwnProduct(ctx.supabase, ctx.supplierId, productId)
  if (!own.ok) return { error: own.error }

  const cleaned = attributes
    .map((a, i) => ({
      name: a.name.trim(),
      options: [...new Set(a.options.map((o) => o.trim()).filter(Boolean))],
      sort_order: i,
    }))
    .filter((a) => a.name && a.options.length)

  await ctx.supabase.from('product_attributes').delete().eq('product_id', productId)

  if (cleaned.length) {
    for (const attr of cleaned) {
      const { data: inserted, error: aErr } = await ctx.supabase
        .from('product_attributes')
        .insert({ product_id: productId, name: attr.name, sort_order: attr.sort_order })
        .select('id')
        .single()
      if (aErr || !inserted) return { error: aErr?.message ?? 'Failed to save attribute' }

      const { error: oErr } = await ctx.supabase.from('product_attribute_options').insert(
        attr.options.map((value, idx) => ({
          attribute_id: inserted.id,
          value,
          sort_order: idx,
        })),
      )
      if (oErr) return { error: oErr.message }
    }
  }

  revalidatePath(`/supplier/products/${productId}`)
  return { error: null }
}

function cartesian<T>(arrays: T[][]): T[][] {
  if (!arrays.length) return [[]]
  return arrays.reduce<T[][]>(
    (acc, cur) => acc.flatMap((prefix) => cur.map((item) => [...prefix, item])),
    [[]],
  )
}

export async function generateVariationsFromMatrix(productId: string) {
  const ctx = await getSupplierContext()
  if (ctx.error || !ctx.supplierId || !ctx.supabase) return { error: ctx.error ?? 'Unauthorized', created: 0 }

  const own = await assertOwnProduct(ctx.supabase, ctx.supplierId, productId)
  if (!own.ok) return { error: own.error, created: 0 }

  const { data: attrs } = await ctx.supabase
    .from('product_attributes')
    .select('id, name, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  if (!attrs?.length) return { error: 'Define attributes first', created: 0 }

  const attrIds = attrs.map((a) => a.id)
  const { data: options } = await ctx.supabase
    .from('product_attribute_options')
    .select('id, attribute_id, value, sort_order')
    .in('attribute_id', attrIds)
    .order('sort_order', { ascending: true })

  const optionsByAttr = new Map<string, { id: string; value: string }[]>()
  for (const opt of options ?? []) {
    const list = optionsByAttr.get(opt.attribute_id) ?? []
    list.push({ id: opt.id, value: opt.value })
    optionsByAttr.set(opt.attribute_id, list)
  }

  const dimensionOptions = attrs.map((a) => optionsByAttr.get(a.id) ?? []).filter((d) => d.length)
  if (dimensionOptions.length !== attrs.length) {
    return { error: 'Each attribute needs at least one option', created: 0 }
  }

  const combos = cartesian(dimensionOptions)
  let created = 0

  for (const combo of combos) {
    const label = combo.map((o) => o.value).join(' / ')
    const optionIds = combo.map((o) => o.id)

    const { data: existingVars } = await ctx.supabase
      .from('product_variations')
      .select('id')
      .eq('product_id', productId)
      .ilike('name', label)

    let variationId: string
    if (existingVars?.length) {
      variationId = existingVars[0].id
    } else {
      const { data: inserted, error: insErr } = await ctx.supabase
        .from('product_variations')
        .insert(
          variationInsertRow(productId, {
            name: label,
            sku: null,
            cost_price: 0,
            price: 0,
            min_order_quantity: 1,
            is_active: true,
          }),
        )
        .select('id')
        .single()
      if (insErr || !inserted) return { error: insErr?.message ?? 'Failed to create variation', created }
      variationId = inserted.id
      created++
    }

    await ctx.supabase.from('variation_attribute_options').delete().eq('variation_id', variationId)
    await ctx.supabase.from('variation_attribute_options').insert(
      optionIds.map((option_id) => ({ variation_id: variationId, option_id })),
    )
  }

  await ctx.supabase
    .from('products')
    .update({ has_variations: true, updated_at: new Date().toISOString() })
    .eq('id', productId)

  revalidatePath(`/supplier/products/${productId}`)
  revalidatePath('/supplier/products')
  return { error: null, created }
}
