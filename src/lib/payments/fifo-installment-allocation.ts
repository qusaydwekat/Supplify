import { roundMoney2 } from '@/lib/currency'

export type InstallmentAllocStub = { id: string; seq: number; amount_due: number }

/** Oldest-open-installment first allocation (matches server payment recording). */
export function fifoInstallmentSlices(
  installments: InstallmentAllocStub[],
  paidToward: Map<string, number>,
  paymentAmount: number,
): { slices: { installment_id: string; amount: number }[]; leftover: number } {
  let left = roundMoney2(paymentAmount)
  const slices: { installment_id: string; amount: number }[] = []
  for (const inst of installments) {
    if (left <= 0.001) break
    const due = roundMoney2(Number(inst.amount_due))
    const already = roundMoney2(paidToward.get(inst.id) ?? 0)
    const outstanding = roundMoney2(due - already)
    if (outstanding <= 0.001) continue
    const alloc = roundMoney2(Math.min(outstanding, left))
    if (alloc > 0.001) {
      slices.push({ installment_id: inst.id, amount: alloc })
      paidToward.set(inst.id, roundMoney2(already + alloc))
      left = roundMoney2(left - alloc)
    }
  }
  return { slices, leftover: left }
}
