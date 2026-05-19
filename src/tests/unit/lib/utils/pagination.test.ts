/**
 * List pagination URL parsing and page math.
 */
import { describe, expect, it } from 'vitest'
import {
  clampPage,
  clampPageSize,
  clampPageToTotal,
  parseListPagination,
  totalPagesFromCount,
} from '@/lib/data/pagination'
import { paginationWindowPages } from '@/lib/pagination-window'

describe('Pagination utilities', () => {
  it('clampPage_InvalidInput_ReturnsOne', () => {
    expect(clampPage(0)).toBe(1)
    expect(clampPage(-3)).toBe(1)
    expect(clampPage(Number.NaN)).toBe(1)
  })

  it('clampPageSize_ExceedsMax_CapsAt100', () => {
    expect(clampPageSize(500)).toBe(100)
  })

  it('totalPagesFromCount_ZeroCount_ReturnsOne', () => {
    expect(totalPagesFromCount(0, 20)).toBe(1)
  })

  it('totalPagesFromCount_41ItemsPage20_ReturnsThreePages', () => {
    expect(totalPagesFromCount(41, 20)).toBe(3)
  })

  it('parseListPagination_PageAndSize_ReadsFromSearchParams', () => {
    const { page, pageSize, from, to } = parseListPagination({ page: '2', pageSize: '10' })
    expect(page).toBe(2)
    expect(pageSize).toBe(10)
    expect(from).toBe(10)
    expect(to).toBe(19)
  })

  it('clampPageToTotal_PageBeyondTotal_ClampsToLastPage', () => {
    expect(clampPageToTotal(9, 3)).toBe(3)
  })

  it('paginationWindowPages_MiddlePage_IncludesEllipsis', () => {
    const pages = paginationWindowPages(5, 10, 1)
    expect(pages).toContain('ellipsis')
    expect(pages[0]).toBe(1)
    expect(pages[pages.length - 1]).toBe(10)
  })
})
