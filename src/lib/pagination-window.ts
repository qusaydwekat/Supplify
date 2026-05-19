/**
 * Builds a compact list of page numbers and gaps for numbered pagination controls.
 * Example (current 5/10, window 5): [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]
 */
export function paginationWindowPages(
  currentPage: number,
  totalPages: number,
  windowNeighbors = 1,
): Array<number | 'ellipsis'> {
  if (totalPages <= 1) return [1]

  const pages = new Set<number>()
  pages.add(1)
  pages.add(totalPages)

  const lo = Math.max(1, currentPage - windowNeighbors)
  const hi = Math.min(totalPages, currentPage + windowNeighbors)
  for (let p = lo; p <= hi; p++) pages.add(p)

  const sorted = [...pages].sort((a, b) => a - b)
  const out: Array<number | 'ellipsis'> = []
  let prev = 0

  for (const p of sorted) {
    if (prev && p > prev + 1) out.push('ellipsis')
    out.push(p)
    prev = p
  }

  return out
}
