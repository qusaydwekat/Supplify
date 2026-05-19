import { faker } from '@faker-js/faker'

export const createFakeLedgerEntry = (overrides = {}) => ({
  id: faker.string.uuid(),
  supplier_id: faker.string.uuid(),
  retailer_id: faker.string.uuid(),
  type: 'invoice' as const,
  amount: parseFloat(faker.finance.amount({ min: 100, max: 5000, dec: 2 })),
  reference_id: faker.string.uuid(),
  description: 'Invoice INV-2025-00001',
  created_at: faker.date.past().toISOString(),
  ...overrides,
})

/** Fixed sequence: 5000 invoice → -2000 payment → 1500 invoice → running 5000, 3000, 4500 */
export const createFakeLedgerSequence = (supplierId: string, retailerId: string) => [
  createFakeLedgerEntry({
    supplier_id: supplierId,
    retailer_id: retailerId,
    type: 'invoice',
    amount: 5000,
    created_at: '2025-01-01T10:00:00Z',
    id: 'e1',
  }),
  createFakeLedgerEntry({
    supplier_id: supplierId,
    retailer_id: retailerId,
    type: 'payment',
    amount: -2000,
    created_at: '2025-01-05T10:00:00Z',
    id: 'e2',
  }),
  createFakeLedgerEntry({
    supplier_id: supplierId,
    retailer_id: retailerId,
    type: 'invoice',
    amount: 1500,
    created_at: '2025-01-10T10:00:00Z',
    id: 'e3',
  }),
]
