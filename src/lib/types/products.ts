import type { MarketplaceCategorySlug } from '@/lib/supplier-marketplace-categories'

export type ProductCatalogStatus = 'draft' | 'published' | 'archived'

export type ProductListRow = {
  id: string
  name: string
  category: string | null
  marketplaceCategory: MarketplaceCategorySlug | null
  catalogStatus: ProductCatalogStatus
  isActive: boolean
  hasVariations: boolean
  updatedAt: string
  variationCount: number
  minStock: number
  hasLowStock: boolean
  imageUrl: string | null
  completenessScore?: number
}

export type ProductListStats = {
  totalProducts: number
  activeProducts: number
  lowStockProducts: number
  draftProducts: number
}

export type ProductListFilters = {
  search?: string
  marketplaceCategory?: string
  status?: 'all' | 'active' | 'inactive'
  catalogStatus?: ProductCatalogStatus | 'all'
  lowStockOnly?: boolean
  sort?: 'updated_desc' | 'name_asc' | 'name_desc' | 'stock_asc'
  page?: number
  pageSize?: number
}

export type VariationMovementRow = {
  id: string
  movementType: string
  quantity: number
  adjustmentIncrease: boolean
  referenceType: string
  notes: string | null
  createdAt: string
  stockAfter: number
}

export type VariationRowData = {
  id: string
  name: string
  sku: string | null
  cost_price: number
  price: number
  stock_quantity: number
  min_order_quantity: number
  reorder_point: number | null
  reorder_qty: number | null
  lead_time_days: number | null
  is_active: boolean
}

export const STOCK_ADJUSTMENT_REASONS = [
  'count_correction',
  'damaged',
  'received_shipment',
  'returned_to_supplier',
  'other',
] as const

export type StockAdjustmentReason = (typeof STOCK_ADJUSTMENT_REASONS)[number]

export function variationLowStockThreshold(minOrderQty: number, reorderPoint: number | null | undefined): number {
  if (reorderPoint != null) return reorderPoint
  return Math.max(minOrderQty * 2, 1)
}

export function isVariationLowStock(
  stock: number,
  minOrderQty: number,
  reorderPoint?: number | null,
): boolean {
  return stock <= variationLowStockThreshold(minOrderQty, reorderPoint)
}
