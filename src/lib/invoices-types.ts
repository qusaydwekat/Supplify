export type InvoiceStatus = 'issued' | 'paid' | 'partial' | 'overdue'

export type InvoiceListRow = {
  id: string
  invoice_number: string
  status: InvoiceStatus
  total: number
  currency_code: string
  issued_at: string
  due_date: string | null
  counterparty: string
  /** Invoice total minus payments recorded in invoice currency, or `null` when balance lookup failed. */
  remaining: number | null
  /** Earliest open due date — first unpaid installment if any, else the invoice's own due_date. */
  next_installment_due: string | null
  /** True when payments could not be loaded (balance + next-due are not authoritative). */
  balances_unavailable: boolean
}

export type InvoiceItemRow = {
  id: string
  product_name: string
  variation_name: string | null
  quantity: number
  unit_price: number
  total_price: number
}

export type ChequeStatus = 'pending_due' | 'deposited' | 'cleared' | 'bounced' | 'replaced'

export type PaymentRow = {
  id: string
  amount: number
  payment_currency: string
  payment_amount: number
  amount_in_default_currency: number
  method: string
  reference_note: string | null
  cheque_number: string | null
  cheque_bank_name: string | null
  cheque_branch: string | null
  cheque_date: string | null
  cheque_bank_branch_id: string | null
  cheque_status: ChequeStatus | null
  cheque_cleared_at: string | null
  cheque_bounced_at: string | null
  cheque_bounce_reason: string | null
  withholding_amount: number
  withholding_reference: string | null
  created_at: string
}

export type InstallmentRow = {
  id: string
  seq: number
  due_date: string
  amount_due: number
  paid_toward: number
  remaining: number
}

export type InvoiceDetail = {
  id: string
  invoice_number: string
  status: InvoiceStatus
  total: number
  currency_code: string
  issued_at: string
  due_date: string | null
  paid_at: string | null
  notes: string | null
  order_id: string
  supplier_id: string
  retailer_id: string
  items: InvoiceItemRow[]
  payments: PaymentRow[]
  paidTotal: number
  remaining: number
  counterparty: string
  installments: InstallmentRow[]
  canEditInstallmentSchedule: boolean
  /** Allocations per payment row for FIFO preview in the edit dialog. */
  paymentAllocations: Record<string, { installment_id: string; amount: number }[]>
}

export type DeliveredOrderOption = {
  id: string
  created_at: string
  total_price: number
  retailerLabel: string
  supplier_currency: string
  /** Default net days for invoice due date from trade terms (fallback 14). */
  default_due_days: number
}
