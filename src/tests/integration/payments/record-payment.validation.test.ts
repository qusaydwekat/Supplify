/**
 * Payment recording validation (schema layer before Supabase).
 */
import { describe, expect, it } from 'vitest'
import { recordPaymentSchema } from '@/lib/validations/payment'

describe('recordPayment schema integration', () => {
  const invoiceId = '11111111-1111-4111-8111-111111111111'

  it('recordPaymentSchema_CashPayment_ValidAmount_Passes', () => {
    const result = recordPaymentSchema.safeParse({
      invoiceId,
      amount: 500,
      paymentCurrency: 'USD',
      method: 'cash',
      referenceNote: '',
    })
    expect(result.success).toBe(true)
  })

  it('recordPaymentSchema_NegativeAmount_Fails', () => {
    const result = recordPaymentSchema.safeParse({
      invoiceId,
      amount: -100,
      paymentCurrency: 'USD',
      method: 'cash',
    })
    expect(result.success).toBe(false)
  })

  it('recordPaymentSchema_InvalidCurrency_Fails', () => {
    const result = recordPaymentSchema.safeParse({
      invoiceId,
      amount: 50,
      paymentCurrency: 'XXX',
      method: 'cash',
    })
    expect(result.success).toBe(false)
  })
})
