/** Aligns with Postgres enum `supplier_marketplace_category` (migration 054). */

export const MARKETPLACE_CATEGORY_SLUGS = [
  'food_beverages',
  'clothing_fashion',
  'pharmacy_health',
  'electronics_tech',
  'home_garden',
  'beauty_personal_care',
  'automotive',
  'office_school',
  'sports_hobbies',
  'general_merchandise',
] as const

export type MarketplaceCategorySlug = (typeof MARKETPLACE_CATEGORY_SLUGS)[number]

const SLUG_SET = new Set<string>(MARKETPLACE_CATEGORY_SLUGS)

export function isMarketplaceCategorySlug(x: string): x is MarketplaceCategorySlug {
  return SLUG_SET.has(x)
}

/** Virtual filter slug (not stored in DB): suppliers with empty `marketplace_categories`. */
export const UNCATEGORIZED_FILTER = 'uncategorized' as const

export function isUncategorizedFilterSlug(x: string): boolean {
  return x === UNCATEGORIZED_FILTER
}

export function parseCatsFromSearchParams(cats: string | string[] | undefined): string[] {
  if (cats == null) return []
  const joined = Array.isArray(cats) ? cats.join(',') : cats
  const out: string[] = []
  const seen = new Set<string>()
  for (const part of joined.split(',')) {
    const t = part.trim()
    if (!t || seen.has(t)) continue
    if (!isMarketplaceCategorySlug(t) && !isUncategorizedFilterSlug(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export function toggleCategorySelection(current: readonly string[], slug: string): string[] {
  const set = new Set(current)
  if (set.has(slug)) set.delete(slug)
  else set.add(slug)
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function serializeCatsParam(cats: string[]): string | undefined {
  const ordered = [...cats].sort((a, b) => a.localeCompare(b))
  return ordered.length ? ordered.join(',') : undefined
}

export function supplierMatchesCategoryFilter(
  supplierCategories: readonly string[] | null | undefined,
  selected: readonly string[],
): boolean {
  if (selected.length === 0) return true
  const hasUncat = selected.includes(UNCATEGORIZED_FILTER)
  const slugs = selected.filter((s): s is MarketplaceCategorySlug => isMarketplaceCategorySlug(s))
  const sup = supplierCategories ?? []
  const overlaps = slugs.some((c) => sup.includes(c))
  const uncatMatch = hasUncat && sup.length === 0
  return overlaps || uncatMatch
}
