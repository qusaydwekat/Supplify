import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'

export type AttributeOptionRow = {
  id: string
  attributeId: string
  value: string
  sortOrder: number
}

export type ProductAttributeRow = {
  id: string
  name: string
  sortOrder: number
  options: AttributeOptionRow[]
}

export type VariationAttributeMap = Map<string, string[]>

export async function listProductAttributes(productId: string): Promise<{
  attributes: ProductAttributeRow[]
  variationOptions: VariationAttributeMap
  error?: string
}> {
  const supabase = supabaseServer()

  const { data: attrs, error: aErr } = await supabase
    .from('product_attributes')
    .select('id, name, sort_order')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })

  if (aErr) return { attributes: [], variationOptions: new Map(), error: aErr.message }

  const attrIds = (attrs ?? []).map((a) => a.id)
  if (!attrIds.length) return { attributes: [], variationOptions: new Map() }

  const { data: options, error: oErr } = await supabase
    .from('product_attribute_options')
    .select('id, attribute_id, value, sort_order')
    .in('attribute_id', attrIds)
    .order('sort_order', { ascending: true })

  if (oErr) return { attributes: [], variationOptions: new Map(), error: oErr.message }

  const { data: varRows } = await supabase
    .from('product_variations')
    .select('id')
    .eq('product_id', productId)

  const variationIds = (varRows ?? []).map((v) => v.id)
  const variationOptions: VariationAttributeMap = new Map()

  if (variationIds.length) {
    const { data: links } = await supabase
      .from('variation_attribute_options')
      .select('variation_id, option_id')
      .in('variation_id', variationIds)

    for (const link of links ?? []) {
      const list = variationOptions.get(link.variation_id) ?? []
      list.push(link.option_id)
      variationOptions.set(link.variation_id, list)
    }
  }

  const optionsByAttr = new Map<string, AttributeOptionRow[]>()
  for (const opt of options ?? []) {
    const list = optionsByAttr.get(opt.attribute_id) ?? []
    list.push({
      id: opt.id,
      attributeId: opt.attribute_id,
      value: opt.value,
      sortOrder: opt.sort_order,
    })
    optionsByAttr.set(opt.attribute_id, list)
  }

  const attributes: ProductAttributeRow[] = (attrs ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    sortOrder: a.sort_order,
    options: optionsByAttr.get(a.id) ?? [],
  }))

  return { attributes, variationOptions }
}

export async function listStorefrontAttributeMatrix(productIds: string[]): Promise<{
  byProduct: Map<string, ProductAttributeRow[]>
  variationOptionIds: Map<string, string[]>
}> {
  if (!productIds.length) {
    return { byProduct: new Map(), variationOptionIds: new Map() }
  }

  const supabase = supabaseServer()
  const { data: attrs } = await supabase
    .from('product_attributes')
    .select('id, product_id, name, sort_order')
    .in('product_id', productIds)
    .order('sort_order', { ascending: true })

  const attrIds = (attrs ?? []).map((a) => a.id)
  const byProduct = new Map<string, ProductAttributeRow[]>()
  const variationOptionIds = new Map<string, string[]>()

  if (!attrIds.length) return { byProduct, variationOptionIds }

  const { data: options } = await supabase
    .from('product_attribute_options')
    .select('id, attribute_id, value, sort_order')
    .in('attribute_id', attrIds)
    .order('sort_order', { ascending: true })

  const optionsByAttr = new Map<string, AttributeOptionRow[]>()
  for (const opt of options ?? []) {
    const list = optionsByAttr.get(opt.attribute_id) ?? []
    list.push({
      id: opt.id,
      attributeId: opt.attribute_id,
      value: opt.value,
      sortOrder: opt.sort_order,
    })
    optionsByAttr.set(opt.attribute_id, list)
  }

  for (const a of attrs ?? []) {
    const row: ProductAttributeRow = {
      id: a.id,
      name: a.name,
      sortOrder: a.sort_order,
      options: optionsByAttr.get(a.id) ?? [],
    }
    const list = byProduct.get(a.product_id) ?? []
    list.push(row)
    byProduct.set(a.product_id, list)
  }

  const { data: vars } = await supabase
    .from('product_variations')
    .select('id, product_id')
    .in('product_id', productIds)

  const variationIds = (vars ?? []).map((v) => v.id)
  if (variationIds.length) {
    const { data: links } = await supabase
      .from('variation_attribute_options')
      .select('variation_id, option_id')
      .in('variation_id', variationIds)

    for (const link of links ?? []) {
      const list = variationOptionIds.get(link.variation_id) ?? []
      list.push(link.option_id)
      variationOptionIds.set(link.variation_id, list)
    }
  }

  return { byProduct, variationOptionIds }
}
