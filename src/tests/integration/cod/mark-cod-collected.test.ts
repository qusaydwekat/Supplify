/**
 * markCodCollected — COD invoice + cash payment flow guards.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markCodCollected } from '@/lib/actions/cod'

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: vi.fn(),
}))

vi.mock('@/lib/actions/invoices', () => ({
  createInvoiceFromOrder: vi.fn(),
}))

vi.mock('@/lib/actions/payments', () => ({
  recordPayment: vi.fn(),
}))

vi.mock('@/lib/data/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import { supabaseServer } from '@/lib/supabase/server'
import { createInvoiceFromOrder } from '@/lib/actions/invoices'
import { recordPayment } from '@/lib/actions/payments'

const orderId = '11111111-1111-4111-8111-111111111111'

describe('markCodCollected', () => {
  beforeEach(() => vi.clearAllMocks())

  it('markCodCollected_NotCodOrder_ReturnsError', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    }
    chain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'sup', user_id: 'u1', currency_code: 'USD' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: orderId,
          supplier_id: 'sup',
          status: 'delivered',
          total_price: 100,
          is_cod: false,
        },
        error: null,
      })

    ;(supabaseServer as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
      from: vi.fn().mockReturnValue(chain),
    })

    const result = await markCodCollected(orderId)
    expect(result.error).toContain('COD')
  })

  it('markCodCollected_AlreadyPaidInvoice_ReturnsAlreadyCollected', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    }
    chain.maybeSingle
      .mockResolvedValueOnce({
        data: { id: 'sup', user_id: 'u1', currency_code: 'USD' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: orderId,
          supplier_id: 'sup',
          status: 'delivered',
          total_price: 100,
          is_cod: true,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'inv-1',
          total: 100,
          currency_code: 'USD',
          status: 'paid',
        },
        error: null,
      })

    ;(supabaseServer as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
      from: vi.fn().mockReturnValue(chain),
    })

    const result = await markCodCollected(orderId)
    expect(result.error).toBeNull()
    expect(result.alreadyCollected).toBe(true)
    expect(createInvoiceFromOrder).not.toHaveBeenCalled()
    expect(recordPayment).not.toHaveBeenCalled()
  })
})
