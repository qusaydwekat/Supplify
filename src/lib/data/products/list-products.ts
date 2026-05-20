import 'server-only'

import { supabaseServer } from '@/lib/supabase/server'
import type { MarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'
import { isMarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'
import type { ProductCatalogStatus, ProductListFilters, ProductListRow, ProductListStats } from '@/lib/types/products'

const DEFAULT_PAGE_SIZE = 20

type RpcProductRow = {
  id: string
  name: string
  category: string | null
  marketplace_category: string | null
  catalog_status: ProductCatalogStatus
  is_active: boolean
  has_variations: boolean
  updated_at: string
  variation_count: number
  min_stock: number
  has_low_stock: boolean
  image_url: string | null
  total_count: number
}

type RpcStatsRow = {
  total_products: number
  active_products: number
  low_stock_products: number
  draft_products: number
}

function mapRow(row: RpcProductRow): ProductListRow {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    marketplaceCategory: isMarketplaceCategorySlug(row.marketplace_category ?? '')
      ? (row.marketplace_category as MarketplaceCategorySlug)
      : null,
    catalogStatus: row.catalog_status ?? 'published',
    isActive: row.is_active,
    hasVariations: row.has_variations,
    updatedAt: row.updated_at,
    variationCount: row.variation_count,
    minStock: row.min_stock,
    hasLowStock: row.has_low_stock,
    imageUrl: row.image_url,
  }
}

export async function listSupplierProducts(
  filters: ProductListFilters = {},
): Promise<{ rows: ProductListRow[]; total: number; error?: string }> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const offset = (page - 1) * pageSize

  const supabase = supabaseServer()
  const { data, error } = await supabase.rpc('supplier_products_paged', {
    p_limit: pageSize,
    p_offset: offset,
    p_search: filters.search?.trim() || null,
    p_marketplace_category: filters.marketplaceCategory?.trim() || null,
    p_status: filters.status ?? 'all',
    p_low_stock_only: filters.lowStockOnly ?? false,
    p_sort: filters.sort ?? 'updated_desc',
    p_catalog_status: filters.catalogStatus && filters.catalogStatus !== 'all' ? filters.catalogStatus : null,
  })

  if (error) return { rows: [], total: 0, error: error.message }

  const raw = (data ?? []) as RpcProductRow[]
  const total = raw[0]?.total_count ?? 0
  const rows = raw.map(mapRow)
  return { rows, total: Number(total) }
}

export async function getSupplierProductListStats(
  filters: Omit<ProductListFilters, 'page' | 'pageSize' | 'sort'> = {},
): Promise<{ stats: ProductListStats; error?: string }> {
  const supabase = supabaseServer()
  const { data, error } = await supabase.rpc('supplier_product_list_stats', {
    p_search: filters.search?.trim() || null,
    p_marketplace_category: filters.marketplaceCategory?.trim() || null,
    p_status: filters.status ?? 'all',
    p_low_stock_only: filters.lowStockOnly ?? false,
    p_catalog_status: filters.catalogStatus && filters.catalogStatus !== 'all' ? filters.catalogStatus : null,
  })

  if (error) {
    return {
      stats: { totalProducts: 0, activeProducts: 0, lowStockProducts: 0, draftProducts: 0 },
      error: error.message,
    }
  }

  const row = (Array.isArray(data) ? data[0] : data) as RpcStatsRow | undefined
  return {
    stats: {
      totalProducts: Number(row?.total_products ?? 0),
      activeProducts: Number(row?.active_products ?? 0),
      lowStockProducts: Number(row?.low_stock_products ?? 0),
      draftProducts: Number(row?.draft_products ?? 0),
    },
  }
}
