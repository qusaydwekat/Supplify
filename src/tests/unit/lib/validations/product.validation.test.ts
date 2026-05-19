/**
 * Zod schemas for products and variations (cost vs selling price rules).
 */
import { describe, expect, it } from 'vitest'
import {
  productCreateSchema,
  variationCreateSchema,
  variationRowSchema,
} from '@/lib/validations/product'
import { deliveryPersonSchema, assignDeliveryPersonSchema } from '@/lib/validations/delivery-person'
import { createInvoiceFromOrderSchema } from '@/lib/validations/invoice'
import { recordPaymentSchema } from '@/lib/validations/payment'
import { createOrderPayloadSchema } from '@/lib/validations/order'

describe('Product Variation Schema', () => {
  const validVariation = {
    name: 'Large / Red',
    sku: 'PROD-LRG-RED',
    cost_price: 10,
    price: 15,
    stock_quantity: 100,
    min_order_quantity: 1,
    is_active: true,
  }

  it('variationRowSchema_ValidData_Passes', () => {
    expect(variationRowSchema.safeParse(validVariation).success).toBe(true)
  })

  it('variationRowSchema_PriceBelowCost_Fails', () => {
    const result = variationRowSchema.safeParse({ ...validVariation, cost_price: 20, price: 15 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('price'))).toBe(true)
    }
  })

  it('variationRowSchema_PriceEqualsCost_Passes', () => {
    expect(variationRowSchema.safeParse({ ...validVariation, cost_price: 15, price: 15 }).success).toBe(true)
  })

  it('variationCreateSchema_NegativeStock_Fails', () => {
    expect(variationCreateSchema.safeParse({ ...validVariation, stock_quantity: -1 }).success).toBe(false)
  })
})

describe('Product Create Schema', () => {
  it('productCreateSchema_SimpleProductWithoutVariations_RequiresPriceFields', () => {
    const result = productCreateSchema.safeParse({
      name: 'Widget',
      has_variations: false,
      is_active: true,
      cost_price: 5,
    })
    expect(result.success).toBe(false)
  })

  it('productCreateSchema_SimpleProductValid_Passes', () => {
    const result = productCreateSchema.safeParse({
      name: 'Widget',
      has_variations: false,
      is_active: true,
      cost_price: 5,
      price: 10,
      stock_quantity: 50,
      min_order_quantity: 1,
    })
    expect(result.success).toBe(true)
  })
})

describe('Delivery Person Schema', () => {
  it('deliveryPersonSchema_ValidInput_Passes', () => {
    const result = deliveryPersonSchema.safeParse({
      name: 'Ahmad Khalil',
      phone: '+970590000000',
      is_active: true,
    })
    expect(result.success).toBe(true)
  })

  it('deliveryPersonSchema_ShortName_Fails', () => {
    expect(deliveryPersonSchema.safeParse({ name: 'A', phone: '+970590000000', is_active: true }).success).toBe(
      false,
    )
  })

  it('assignDeliveryPersonSchema_InvalidOrderId_Fails', () => {
    expect(
      assignDeliveryPersonSchema.safeParse({ orderId: 'not-uuid', deliveryPersonId: crypto.randomUUID() }).success,
    ).toBe(false)
  })
})

describe('Invoice From Order Schema', () => {
  it('createInvoiceFromOrderSchema_ZeroDueDays_Fails', () => {
    expect(
      createInvoiceFromOrderSchema.safeParse({
        orderId: crypto.randomUUID(),
        dueInDays: 0,
      }).success,
    ).toBe(false)
  })

  it('createInvoiceFromOrderSchema_ValidDueDays_Passes', () => {
    expect(
      createInvoiceFromOrderSchema.safeParse({
        orderId: crypto.randomUUID(),
        dueInDays: 14,
      }).success,
    ).toBe(true)
  })
})

describe('Record Payment Schema', () => {
  it('recordPaymentSchema_ZeroAmount_Fails', () => {
    const result = recordPaymentSchema.safeParse({
      invoiceId: crypto.randomUUID(),
      amount: 0,
      paymentCurrency: 'USD',
      method: 'cash',
    })
    expect(result.success).toBe(false)
  })

  it('recordPaymentSchema_ChequeWithoutBank_Fails', () => {
    const result = recordPaymentSchema.safeParse({
      invoiceId: crypto.randomUUID(),
      amount: 100,
      paymentCurrency: 'USD',
      method: 'cheque',
      chequeNumber: '123',
      chequeDate: '2025-06-01',
    })
    expect(result.success).toBe(false)
  })
})

describe('Create Order Schema', () => {
  it('createOrderPayloadSchema_EmptyItems_Fails', () => {
    expect(
      createOrderPayloadSchema.safeParse({
        items: [],
        supplierId: crypto.randomUUID(),
      }).success,
    ).toBe(false)
  })
})
