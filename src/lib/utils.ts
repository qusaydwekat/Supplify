import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Safe columns for retailer-facing `product_variations` queries (excludes cost and profit). */
export const VARIATION_PUBLIC_COLUMNS =
  'id, name, sku, price, stock_quantity, min_order_quantity, product_id, is_active' as const

export function formatCurrency(value: number, currency: string = 'USD') {
  return new Intl.NumberFormat('ar', { style: 'currency', currency }).format(value)
}

