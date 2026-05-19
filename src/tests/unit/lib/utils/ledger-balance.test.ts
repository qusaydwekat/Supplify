/**
 * Covers running balance and net balance math for the retailer/supplier ledger.
 */
import { describe, expect, it } from 'vitest'
import {
  calculateFinalBalance,
  calculateRunningBalance,
  sortLedgerEntriesAsc,
} from '@/lib/ledger-balance'
import { createFakeLedgerSequence } from '@/tests/factories/ledger.factory'

describe('Ledger Balance Calculation', () => {
  const supplierId = 'supplier-123'
  const retailerId = 'retailer-456'
  const entries = createFakeLedgerSequence(supplierId, retailerId)

  describe('calculateRunningBalance', () => {
    it('calculateRunningBalance_ValidSequence_ReturnsSameLength', () => {
      const result = calculateRunningBalance(entries)
      expect(result).toHaveLength(entries.length)
    })

    it('calculateRunningBalance_FirstEntry_RunningEqualsAmount', () => {
      const result = calculateRunningBalance(entries)
      expect(result[0].running_balance).toBe(5000)
    })

    it('calculateRunningBalance_AfterPayment_SubtractsCorrectly', () => {
      const result = calculateRunningBalance(entries)
      expect(result[1].running_balance).toBe(3000)
    })

    it('calculateRunningBalance_AfterSecondInvoice_AddsCorrectly', () => {
      const result = calculateRunningBalance(entries)
      expect(result[2].running_balance).toBe(4500)
    })

    it('calculateRunningBalance_EmptyArray_ReturnsEmpty', () => {
      expect(calculateRunningBalance([])).toEqual([])
    })

    it('calculateRunningBalance_SingleInvoice_ReturnsThatAmount', () => {
      const single = [entries[0]]
      const result = calculateRunningBalance(single)
      expect(result[0].running_balance).toBe(5000)
    })

    it('calculateRunningBalance_OnlyPayments_ReturnsNegativeBalance', () => {
      const onlyPayments = [
        { amount: -1000, created_at: '2025-01-01T10:00:00Z', id: 'a' },
        { amount: -500, created_at: '2025-01-02T10:00:00Z', id: 'b' },
      ]
      const result = calculateRunningBalance(onlyPayments)
      expect(result[1].running_balance).toBe(-1500)
    })

    it('calculateRunningBalance_UnsortedInput_SortsByCreatedAtAsc', () => {
      const shuffled = [...entries].reverse()
      const result = calculateRunningBalance(shuffled)
      expect(result[result.length - 1].running_balance).toBe(4500)
    })
  })

  describe('calculateFinalBalance', () => {
    it('calculateFinalBalance_ValidSequence_ReturnsNetSum', () => {
      expect(calculateFinalBalance(entries)).toBe(4500)
    })

    it('calculateFinalBalance_EmptyArray_ReturnsZero', () => {
      expect(calculateFinalBalance([])).toBe(0)
    })

    it('calculateFinalBalance_BalancedEntries_ReturnsZero', () => {
      const balanced = [
        { amount: 1000, created_at: '2025-01-01T10:00:00Z' },
        { amount: -1000, created_at: '2025-01-02T10:00:00Z' },
      ]
      expect(calculateFinalBalance(balanced)).toBe(0)
    })
  })

  describe('sortLedgerEntriesAsc', () => {
    it('sortLedgerEntriesAsc_ReverseInput_OrdersOldestFirst', () => {
      const sorted = sortLedgerEntriesAsc([...entries].reverse())
      expect(sorted[0].id).toBe('e1')
      expect(sorted[2].id).toBe('e3')
    })

    it('sortLedgerEntriesAsc_SameTimestamp_SortsById', () => {
      const sorted = sortLedgerEntriesAsc([
        { amount: 1, created_at: '2025-01-01T10:00:00Z', id: 'b' },
        { amount: 2, created_at: '2025-01-01T10:00:00Z', id: 'a' },
      ])
      expect(sorted[0].id).toBe('a')
    })
  })
})
