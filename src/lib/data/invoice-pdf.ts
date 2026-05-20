import 'server-only'

import { getInvoiceForViewer } from '@/lib/data/invoices'
import type { InvoiceStatus } from '@/lib/invoices-types'
import { supabaseServer } from '@/lib/supabase/server'
import type { InvoicePdfLine } from '@/lib/pdf/invoice-document'

export type InvoicePdfParty = {
  businessName: string
  contactName: string | null
  phone: string | null
  city: string | null
  address: string | null
  taxId: string | null
  commercialRegistration: string | null
  vatRegistered: boolean
}

export type InvoicePdfBank = {
  bankName: string
  branch: string | null
  accountHolder: string
  iban: string | null
  accountNumber: string | null
  swift: string | null
}

export type InvoicePdfInstallment = {
  seq: number
  dueDate: string
  amountDue: number
  remaining: number
}

export type InvoicePdfPayload = {
  invoiceNumber: string
  status: InvoiceStatus
  issuedAt: string
  dueDate: string | null
  paidAt: string | null
  orderRef: string
  currencyCode: string
  supplier: InvoicePdfParty
  retailer: InvoicePdfParty
  lines: InvoicePdfLine[]
  notes: string | null
  total: number
  paidTotal: number
  remaining: number
  installments: InvoicePdfInstallment[]
  bank: InvoicePdfBank | null
}

type ProfileRow = {
  name: string | null
  business_name: string | null
  phone: string | null
  city: string | null
  address: string | null
  tax_id: string | null
  commercial_registration: string | null
  vat_registered: boolean | null
}

function profileToParty(row: ProfileRow | null | undefined, fallback: string): InvoicePdfParty {
  const businessName = row?.business_name?.trim() || row?.name?.trim() || fallback
  const contactName =
    row?.business_name?.trim() && row?.name?.trim() && row.business_name.trim() !== row.name.trim()
      ? row.name.trim()
      : null
  return {
    businessName,
    contactName,
    phone: row?.phone?.trim() || null,
    city: row?.city?.trim() || null,
    address: row?.address?.trim() || null,
    taxId: row?.tax_id?.trim() || null,
    commercialRegistration: row?.commercial_registration?.trim() || null,
    vatRegistered: Boolean(row?.vat_registered),
  }
}

function orderRefFromId(orderId: string): string {
  const compact = orderId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return compact || orderId.slice(0, 8)
}

export async function getInvoicePdfPayload(
  invoiceId: string,
): Promise<{ payload: InvoicePdfPayload } | { error: string }> {
  const res = await getInvoiceForViewer(invoiceId)
  if ('error' in res) return { error: res.error }

  const inv = res.invoice
  const supabase = supabaseServer()

  const { data: supplierRow } = await supabase
    .from('suppliers')
    .select('user_id')
    .eq('id', inv.supplier_id)
    .maybeSingle()

  const supplierUserId = supplierRow?.user_id
  if (!supplierUserId) return { error: 'Supplier not found' }

  const profileSelect =
    'name, business_name, phone, city, address, tax_id, commercial_registration, vat_registered'

  const [{ data: supplierProfile }, { data: retailerProfile }, { data: bankRow }] = await Promise.all([
    supabase.from('profiles').select(profileSelect).eq('user_id', supplierUserId).maybeSingle(),
    supabase.from('profiles').select(profileSelect).eq('user_id', inv.retailer_id).maybeSingle(),
    supabase
      .from('supplier_bank_accounts')
      .select('bank_name, branch, account_holder, iban, account_number, swift')
      .eq('supplier_id', inv.supplier_id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('bank_name')
      .limit(1)
      .maybeSingle(),
  ])

  const bank: InvoicePdfBank | null = bankRow
    ? {
        bankName: String(bankRow.bank_name),
        branch: bankRow.branch?.trim() || null,
        accountHolder: String(bankRow.account_holder),
        iban: bankRow.iban?.trim() || null,
        accountNumber: bankRow.account_number?.trim() || null,
        swift: bankRow.swift?.trim() || null,
      }
    : null

  return {
    payload: {
      invoiceNumber: inv.invoice_number,
      status: inv.status,
      issuedAt: inv.issued_at,
      dueDate: inv.due_date,
      paidAt: inv.paid_at,
      orderRef: orderRefFromId(inv.order_id),
      currencyCode: inv.currency_code,
      supplier: profileToParty(supplierProfile as ProfileRow | null, 'Supplier'),
      retailer: profileToParty(retailerProfile as ProfileRow | null, inv.counterparty),
      lines: inv.items.map((i) => ({
        product_name: i.product_name,
        variation_name: i.variation_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.total_price,
      })),
      notes: inv.notes,
      total: inv.total,
      paidTotal: inv.paidTotal,
      remaining: inv.remaining,
      installments: inv.installments.map((inst) => ({
        seq: inst.seq,
        dueDate: inst.due_date,
        amountDue: inst.amount_due,
        remaining: inst.remaining,
      })),
      bank,
    },
  }
}
