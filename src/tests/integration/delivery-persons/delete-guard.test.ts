/**
 * deleteDeliveryPerson — blocks delete when person has in-transit orders.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDeliveryPerson } from '@/lib/actions/delivery-persons'
import { createAuthMock } from '@/tests/mocks/supabase.mock'

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: vi.fn(),
}))

import { supabaseServer } from '@/lib/supabase/server'

const supplier = { id: 'sup-1' }
const dpId = '22222222-2222-4222-8222-222222222222'

function ordersQueryResult(data: { id: string }[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: (v: { data: typeof data; error: null }) => void) =>
      Promise.resolve({ data, error: null }).then(resolve),
  }
  return chain
}

function supplierLookupChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: supplier, error: null }),
  }
}

function deleteChain() {
  return {
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }
}

describe('deleteDeliveryPerson', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deleteDeliveryPerson_ActiveShippedOrders_ReturnsInTransitError', async () => {
    let fromCall = 0
    const from = vi.fn(() => {
      fromCall += 1
      if (fromCall === 1) return supplierLookupChain()
      if (fromCall === 2) return ordersQueryResult([{ id: 'order-1' }])
      return deleteChain()
    })

    ;(supabaseServer as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: createAuthMock({ id: 'user-1' }),
      from,
    })

    const result = await deleteDeliveryPerson(dpId)
    expect(result.error).toMatch(/in-transit/i)
  })

  it('deleteDeliveryPerson_NoActiveOrders_ReturnsNoError', async () => {
    let fromCall = 0
    const from = vi.fn(() => {
      fromCall += 1
      if (fromCall === 1) return supplierLookupChain()
      if (fromCall === 2) return ordersQueryResult([])
      return deleteChain()
    })

    ;(supabaseServer as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: createAuthMock({ id: 'user-1' }),
      from,
    })

    const result = await deleteDeliveryPerson(dpId)
    expect(result.error).toBeNull()
  })
})
