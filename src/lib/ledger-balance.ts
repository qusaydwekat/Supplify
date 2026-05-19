/** Pure ledger running-balance helpers (used by tests and can be wired into ledger data layer). */

export type LedgerAmountRow = {
  amount: number
  created_at: string
  id?: string
}

export function roundLedgerMoney(n: number) {
  return Math.round(n * 100) / 100
}

export function sortLedgerEntriesAsc<T extends LedgerAmountRow>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const byTime = a.created_at.localeCompare(b.created_at)
    if (byTime !== 0) return byTime
    return String(a.id ?? '').localeCompare(String(b.id ?? ''))
  })
}

export function calculateRunningBalance<T extends LedgerAmountRow>(
  entries: T[],
): Array<T & { running_balance: number }> {
  const sorted = sortLedgerEntriesAsc(entries)
  let running = 0
  return sorted.map((entry) => {
    running = roundLedgerMoney(running + Number(entry.amount))
    return { ...entry, running_balance: running }
  })
}

export function calculateFinalBalance(entries: LedgerAmountRow[]): number {
  const sum = entries.reduce((s, e) => s + Number(e.amount), 0)
  return roundLedgerMoney(sum)
}
