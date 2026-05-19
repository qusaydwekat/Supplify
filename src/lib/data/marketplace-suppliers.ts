import type { MarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'

/** Rows returned by marketplace supplier discovery RPCs (join suppliers + users.role = supplier). */
export type MarketplaceSupplierListRow = {
  id: string
  user_id: string
  description: string | null
  delivery_areas: string[] | null
  logo_url: string | null
  is_active: boolean
  avg_rating: number | null
  review_count: number | null
  marketplace_categories?: MarketplaceCategorySlug[] | string[] | null
}

/** `get_marketplace_supplier` RPC row (includes currency for storefront). */
export type MarketplaceSupplierStorefrontRow = MarketplaceSupplierListRow & {
  currency_code: string
}
