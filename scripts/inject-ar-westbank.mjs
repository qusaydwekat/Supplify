// One-shot helper to inject Arabic keys for the West Bank features batch
// into the messages/ar.json file. Idempotent: skips blocks already present.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const arPath = join(__dirname, '..', 'messages', 'ar.json')

const src = await readFile(arPath, 'utf8')
let next = src

function inject({ anchor, marker, insert }) {
  if (next.includes(marker)) return false
  const idx = next.indexOf(anchor)
  if (idx === -1) throw new Error(`Anchor not found: ${anchor}`)
  next = next.slice(0, idx) + insert + next.slice(idx)
  return true
}

inject({
  anchor: '"deliveryFallback": "معلومات التسليم غير متوفرة. يُرجى التواصل مع المورد."\n  },',
  marker: '"codBadge"',
  insert:
    '"deliveryFallback": "معلومات التسليم غير متوفرة. يُرجى التواصل مع المورد.",\n    "codBadge": "الدفع عند الاستلام",\n    "codSupplierHint": "اقبض المبلغ نقداً من التاجر عند التسليم، ثم أكِّد هنا لإصدار الفاتورة وتأشيرها كمدفوعة.",\n    "codRetailerHint": "ستدفع نقداً عند تسليم الطلب. لا حاجة لتحويل بنكي.",\n    "whatsappOrderMessage": "الطلب {orderId} — الإجمالي {total} ({counterparty}). تابعه على Supplify."\n  RECONSTRUCT_PLACEHOLDER},',
})

// Above approach is brittle — abort and use JSON parse round-trip instead.
const data = JSON.parse(src)

function ensure(ns, patch) {
  if (!data[ns] || typeof data[ns] !== 'object') return
  for (const [k, v] of Object.entries(patch)) {
    if (data[ns][k] == null) data[ns][k] = v
  }
}

ensure('OrderDetailPage', {
  codBadge: 'الدفع عند الاستلام',
  codSupplierHint:
    'اقبض المبلغ نقداً من التاجر عند التسليم، ثم أكِّد هنا لإصدار الفاتورة وتأشيرها كمدفوعة.',
  codRetailerHint: 'ستدفع نقداً عند تسليم الطلب. لا حاجة لتحويل بنكي.',
  whatsappOrderMessage:
    'الطلب {orderId} — الإجمالي {total} ({counterparty}). تابعه على Supplify.',
})

ensure('InvoiceDetailPage', {
  withholdingApplied: 'تمّ تطبيق خصم المصدر',
  whatsappShareMessage:
    'فاتورة {invoice} من {counterparty} — الإجمالي {total}. اطّلع عليها في Supplify.',
})

ensure('RecordPaymentForm', {
  withholdingTitle: 'خصم المصدر',
  withholdingHint:
    'سجّل أي مبلغ احتجزه التاجر للضريبة. يبقى المبلغ المسجَّل أعلاه هو المخصوم من الفاتورة.',
  withholdingAmount: 'المبلغ المحجوز ({code})',
  withholdingReference: 'رقم شهادة خصم المصدر',
})

ensure('OrderAudit', {
  chequeDeposited: 'تمّ إيداع الشيك في البنك',
  chequeCleared: 'تمّ تحصيل الشيك',
  chequeBounced: 'ارتدّ الشيك',
  chequeReplaced: 'تمّ استبدال الشيك',
  depositProofSubmitted: 'أرسل التاجر بياناً عن إيداع بنكي',
  depositProofConfirmed: 'تمّ تأكيد بيان الإيداع البنكي',
  depositProofRejected: 'تمّ رفض بيان الإيداع البنكي',
  codCollected: 'تمّ تحصيل المبلغ نقداً عند التسليم',
})

ensure('Nav', {
  depositProofs: 'بيانات الإيداع',
})

await writeFile(arPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log('Arabic West Bank keys injected (idempotent).')
