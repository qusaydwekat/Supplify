/**
 * Default ordering for order lists across the app: newest first, stable tie-break by id.
 * Use after filters and before range/limit.
 */
export function orderRowsNewestFirst<T extends { order: (col: string, opts: { ascending: boolean }) => T }>(q: T): T {
  return q.order('created_at', { ascending: false }).order('id', { ascending: false })
}
