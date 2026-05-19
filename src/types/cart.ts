export type CartItem = {
  variationId: string
  productId: string
  supplierId: string
  /** ISO 4217 — used when switching cart to this supplier */
  supplierCurrency?: string
  productName: string
  variationName: string | null
  quantity: number
  unitPrice: number
}
