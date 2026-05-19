/**
 * markOrderShippedWithDeliveryPerson — status guards and validation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { markOrderShippedWithDeliveryPerson } from '@/lib/actions/delivery-persons'
import { createAuthMock } from '@/tests/mocks/supabase.mock'

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: vi.fn(() => ({
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  })),
}))

vi.mock('@/lib/data/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import { supabaseServer } from '@/lib/supabase/server'

const orderId = '11111111-1111-4111-8111-111111111111'
const deliveryPersonId = '22222222-2222-4222-8222-222222222222'
const supplier = { id: '33333333-3333-4333-8333-333333333333' }

function mockSupabaseChain(responses: Record<string, unknown>) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  }
  for (const k of Object.keys(chain)) {
    chain[k].mockReturnValue(chain)
  }
  chain.maybeSingle.mockImplementation(() =>
    Promise.resolve(responses.maybeSingle ?? { data: null, error: null }),
  )
  chain.update.mockImplementation(() =>
    Promise.resolve(responses.update ?? { data: {}, error: null }),
  )
  chain.from.mockReturnValue(chain)
  return chain
}

describe('markOrderShippedWithDeliveryPerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('markOrderShippedWithDeliveryPerson_NoSupplier_ReturnsUnauthorized', async () => {
    ;(supabaseServer as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: createAuthMock({ id: 'user-1' }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })

    const result = await markOrderShippedWithDeliveryPerson({ orderId, deliveryPersonId })
    expect(result.error).toBe('Unauthorized')
  })

  it('markOrderShippedWithDeliveryPerson_WrongOrderStatus_ReturnsError', async () => {
    let call = 0
    const from = vi.fn(() => {
      call += 1
      if (call === 1) {
        return mockSupabaseChain({ maybeSingle: { data: supplier, error: null } })
      }
      return mockSupabaseChain({
        maybeSingle: {
          data: { id: orderId, status: 'accepted', supplier_id: supplier.id, retailer_id: 'r1' },
          error: null,
        },
      })
    })

    ;(supabaseServer as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: createAuthMock({ id: 'user-1' }),
      from,
    })

    const result = await markOrderShippedWithDeliveryPerson({ orderId, deliveryPersonId })
    expect(result.error).toContain('preparing')
  })

  it('markOrderShippedWithDeliveryPerson_EmptyDeliveryPersonId_FailsValidation', async () => {
    ;(supabaseServer as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: createAuthMock({ id: 'user-1' }),
      from: vi.fn().mockReturnValue(mockSupabaseChain({ maybeSingle: { data: supplier, error: null } })),
    })

    const result = await markOrderShippedWithDeliveryPerson({ orderId, deliveryPersonId: '' })
    expect(result.error).toBeTruthy()
  })
})
