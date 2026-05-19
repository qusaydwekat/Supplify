const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

export function utcStartOfCalendarDay(isoDay: string): Date | null {
  const m = DAY.exec(isoDay.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null
  return dt
}

/** RPC uses `posted_at < p_to` — pass start of day after inclusive end. */
export function utcEndExclusiveAfterInclusiveDay(isoDayInclusive: string): Date | null {
  const start = utcStartOfCalendarDay(isoDayInclusive)
  if (!start) return null
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1, 0, 0, 0, 0))
}

function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0))
}

export function defaultFinanceMonthBounds(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  const toEx = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
  const lastInclusive = new Date(toEx.getTime() - 86400000)
  return { from, toExclusive: toEx, lastInclusive }
}

export function previousMonthBounds(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0))
  const toEx = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  const lastInclusive = new Date(toEx.getTime() - 86400000)
  return { from, toExclusive: toEx, lastInclusive }
}

export function lastNDaysBounds(days: number, now = new Date()) {
  const today = utcDay(now)
  const toEx = new Date(today.getTime() + 86400000)
  const from = new Date(today.getTime() - (days - 1) * 86400000)
  return { from, toExclusive: toEx, lastInclusive: today }
}

export function yearToDateBounds(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0))
  const today = utcDay(now)
  const toEx = new Date(today.getTime() + 86400000)
  return { from, toExclusive: toEx, lastInclusive: today }
}

export type FinanceBounds = {
  from: Date
  toExclusive: Date
  lastInclusive: Date
}

/** Same length as `bounds`, anchored to the day immediately before `bounds.from`. */
export function priorPeriodBounds(bounds: FinanceBounds): FinanceBounds {
  const lengthMs = bounds.toExclusive.getTime() - bounds.from.getTime()
  const toEx = bounds.from
  const from = new Date(bounds.from.getTime() - lengthMs)
  const lastInclusive = new Date(toEx.getTime() - 86400000)
  return { from, toExclusive: toEx, lastInclusive }
}

export function ymdUtc(d: Date) {
  return d.toISOString().slice(0, 10)
}
