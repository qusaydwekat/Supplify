import type { InvoiceStatus } from '@/lib/invoices-types'
import type { AppLocale } from '@/i18n/routing'
import { deepMergeMessages } from '@/i18n/merge-messages'

export type InvoicePdfLabels = {
  documentTitle: string
  invoiceNo: string
  brand: string
  headerTitle: string
  headerSub: string
  statusIssued: string
  statusPaid: string
  statusPartial: string
  statusOverdue: string
  fromSupplier: string
  billToRetailer: string
  tel: string
  vatRegistered: string
  taxId: string
  commercialReg: string
  issued: string
  dueDate: string
  orderRef: string
  currency: string
  paidOn: string
  lineItems: string
  colDescription: string
  colQty: string
  colUnitPrice: string
  colAmount: string
  amountSummary: string
  invoiceTotal: string
  amountPaid: string
  balanceDue: string
  installmentSchedule: string
  installmentDue: string
  paymentDetails: string
  bank: string
  branch: string
  accountHolder: string
  iban: string
  accountNo: string
  swift: string
  notes: string
  footerRef: string
  footerThanks: string
}

type InvoicePdfMessages = {
  documentTitle: string
  invoiceNo: string
  brand: string
  headerTitle: string
  headerSub: string
  status_issued: string
  status_paid: string
  status_partial: string
  status_overdue: string
  fromSupplier: string
  billToRetailer: string
  tel: string
  vatRegistered: string
  taxId: string
  commercialReg: string
  issued: string
  dueDate: string
  orderRef: string
  currency: string
  paidOn: string
  lineItems: string
  colDescription: string
  colQty: string
  colUnitPrice: string
  colAmount: string
  amountSummary: string
  invoiceTotal: string
  amountPaid: string
  balanceDue: string
  installmentSchedule: string
  installmentDue: string
  paymentDetails: string
  bank: string
  branch: string
  accountHolder: string
  iban: string
  accountNo: string
  swift: string
  notes: string
  footerRef: string
  footerThanks: string
}

async function loadMessages(locale: AppLocale) {
  const ar = (await import('../../../messages/ar.json')).default
  if (locale === 'ar') return ar
  const overlay = (await import('../../../messages/en.overlay.json')).default
  return deepMergeMessages(ar, overlay)
}

function pick(m: InvoicePdfMessages): InvoicePdfLabels {
  return {
    documentTitle: m.documentTitle,
    invoiceNo: m.invoiceNo,
    brand: m.brand,
    headerTitle: m.headerTitle,
    headerSub: m.headerSub,
    statusIssued: m.status_issued,
    statusPaid: m.status_paid,
    statusPartial: m.status_partial,
    statusOverdue: m.status_overdue,
    fromSupplier: m.fromSupplier,
    billToRetailer: m.billToRetailer,
    tel: m.tel,
    vatRegistered: m.vatRegistered,
    taxId: m.taxId,
    commercialReg: m.commercialReg,
    issued: m.issued,
    dueDate: m.dueDate,
    orderRef: m.orderRef,
    currency: m.currency,
    paidOn: m.paidOn,
    lineItems: m.lineItems,
    colDescription: m.colDescription,
    colQty: m.colQty,
    colUnitPrice: m.colUnitPrice,
    colAmount: m.colAmount,
    amountSummary: m.amountSummary,
    invoiceTotal: m.invoiceTotal,
    amountPaid: m.amountPaid,
    balanceDue: m.balanceDue,
    installmentSchedule: m.installmentSchedule,
    installmentDue: m.installmentDue,
    paymentDetails: m.paymentDetails,
    bank: m.bank,
    branch: m.branch,
    accountHolder: m.accountHolder,
    iban: m.iban,
    accountNo: m.accountNo,
    swift: m.swift,
    notes: m.notes,
    footerRef: m.footerRef,
    footerThanks: m.footerThanks,
  }
}

export async function loadInvoicePdfLabels(locale: AppLocale): Promise<InvoicePdfLabels> {
  const messages = await loadMessages(locale)
  const block = (messages as { InvoicePdf?: InvoicePdfMessages }).InvoicePdf
  if (!block) {
    throw new Error('Missing InvoicePdf messages')
  }
  return pick(block)
}

export function pdfStatusLabel(labels: InvoicePdfLabels, status: InvoiceStatus): string {
  switch (status) {
    case 'paid':
      return labels.statusPaid
    case 'partial':
      return labels.statusPartial
    case 'overdue':
      return labels.statusOverdue
    default:
      return labels.statusIssued
  }
}

export function formatLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))
}
