/**
 * createInvoiceFromOrder server action — auth and validation paths.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInvoiceFromOrder } from '@/lib/actions/invoices'
import { createAuthMock, createSupabaseQueryMock } from '@/tests/mocks/supabase.mock'

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: vi.fn(() => ({
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  })),
}))

vi.mock('@/lib/data/domain-audit', () => ({
  insertDomainAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/data/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import { supabaseServer } from '@/lib/supabase/server'

describe('createInvoiceFromOrder', () => {
  const orderId = '22222222-2222-4222-8222-222222222222'
  const user = { id: '33333333-3333-4333-8333-333333333333' }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createInvoiceFromOrder_Unauthenticated_ReturnsUnauthorized', async () => {
    ;(supabaseServer as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: createAuthMock(null),
    })

    const result = await createInvoiceFromOrder({ orderId, dueInDays: 14 })
    expect(result.error).toBe('Unauthorized')
    expect(result.invoiceId).toBeNull()
  })

  it('createInvoiceFromOrder_InvalidDueDays_ReturnsValidationError', async () => {
    const result = await createInvoiceFromOrder({ orderId, dueInDays: 0 })
    expect(result.invoiceId).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('createInvoiceFromOrder_ValidInput_ReturnsInvoiceId', async () => {
    const invoiceId = '44444444-4444-4444-8444-444444444444'
    const query = createSupabaseQueryMock(async () => ({ data: invoiceId, error: null }))
    query.rpc.mockResolvedValue({ data: invoiceId, error: null })

    ;(supabaseServer as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: createAuthMock(user),
      from: query.from,
      rpc: query.rpc,
    })

    query.from.mockImplementation(() => ({
      ...query,
      select: query.select,
      eq: query.eq,
      maybeSingle: vi.fn().mockResolvedValue({
        data: { invoice_number: 'INV-1', retailer_id: '55555555-5555-4555-8555-555555555555' },
        error: null,
      }),
    }))

    const result = await createInvoiceFromOrder({ orderId, dueInDays: 14 })
    expect(result.error).toBeNull()
    expect(result.invoiceId).toBe(invoiceId)
  })
})
