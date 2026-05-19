/**
 * Profit margin percentage and badge tier helpers.
 */
import { describe, expect, it } from 'vitest'
import {
  calculateProfitMarginPct,
  calculateProfitPerUnit,
  getProfitMarginTier,
  marginBadgeClass,
} from '@/lib/profit-margin'

describe('Profit Margin Utilities', () => {
  describe('calculateProfitMarginPct', () => {
    it('calculateProfitMarginPct_ValidPrices_ReturnsMarginPct', () => {
      expect(calculateProfitMarginPct(10, 30)).toBeCloseTo(66.67, 1)
    })

    it('calculateProfitMarginPct_EqualCostAndPrice_ReturnsZero', () => {
      expect(calculateProfitMarginPct(20, 20)).toBe(0)
    })

    it('calculateProfitMarginPct_ZeroPrice_ReturnsZero', () => {
      expect(calculateProfitMarginPct(0, 0)).toBe(0)
    })

    it('calculateProfitMarginPct_PriceBelowCost_ReturnsNegative', () => {
      expect(calculateProfitMarginPct(30, 25)).toBeLessThan(0)
    })
  })

  describe('calculateProfitPerUnit', () => {
    it('calculateProfitPerUnit_ValidPrices_ReturnsDifference', () => {
      expect(calculateProfitPerUnit(10, 25)).toBe(15)
    })
  })

  describe('getProfitMarginTier', () => {
    it('getProfitMarginTier_HighMargin_ReturnsEmerald', () => {
      expect(getProfitMarginTier(40)).toBe('emerald')
      expect(getProfitMarginTier(55)).toBe('emerald')
    })

    it('getProfitMarginTier_MidMargin_ReturnsGreen', () => {
      expect(getProfitMarginTier(20)).toBe('green')
    })

    it('getProfitMarginTier_LowMargin_ReturnsAmber', () => {
      expect(getProfitMarginTier(10)).toBe('amber')
    })

    it('getProfitMarginTier_VeryLowMargin_ReturnsRed', () => {
      expect(getProfitMarginTier(5)).toBe('red')
    })
  })

  describe('marginBadgeClass', () => {
    it('marginBadgeClass_HighMargin_IncludesEmeraldClasses', () => {
      expect(marginBadgeClass(50)).toContain('emerald')
    })

    it('marginBadgeClass_MidMargin_IncludesGreenClasses', () => {
      expect(marginBadgeClass(25)).toContain('green')
    })

    it('marginBadgeClass_LowMargin_IncludesAmberClasses', () => {
      expect(marginBadgeClass(12)).toContain('amber')
    })

    it('marginBadgeClass_LowMargin_IncludesRedClasses', () => {
      expect(marginBadgeClass(0)).toContain('red')
    })
  })
})
