import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowDown, ArrowRight, GitCompareArrows } from 'lucide-react'
import type { AuditLogRow } from '@/lib/data/audit-log'
import type { OrderItemRow } from '@/lib/data/orders'
import { formatDateTimeShort, normalizeAppLocale } from '@/lib/format-datetime'
import { formatMoney } from '@/lib/format-money'
import { cn } from '@/lib/utils'

type AuditLine = {
  order_item_id: string
  product_label: string
  old_quantity: number
  new_quantity: number
  old_unit_price: number
  new_unit_price: number
}

function parseAuditLines(metadata: Record<string, unknown>): AuditLine[] {
  const raw = metadata.lines
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x.order_item_id === 'string')
    .map((x) => ({
      order_item_id: x.order_item_id as string,
      product_label: String(x.product_label ?? ''),
      old_quantity: Number(x.old_quantity ?? 0),
      new_quantity: Number(x.new_quantity ?? 0),
      old_unit_price: Number(x.old_unit_price ?? 0),
      new_unit_price: Number(x.new_unit_price ?? 0),
    }))
}

/** Order total before the latest supplier modification (derived from audit + current rows). */
function computePreviousOrderTotal(items: OrderItemRow[], lines: AuditLine[]): number {
  const changed = new Map(lines.map((l) => [l.order_item_id, l]))
  let sum = 0
  for (const it of items) {
    const ch = changed.get(it.id)
    if (ch) sum += ch.old_quantity * ch.old_unit_price
    else sum += Number(it.total_price)
  }
  return Math.round(sum * 100) / 100
}

function latestModificationAudit(audit: AuditLogRow[]): { row: AuditLogRow; lines: AuditLine[] } | null {
  // Audit is newest-first — use the latest supplier modification event
  for (const row of audit) {
    if (row.event_type !== 'order_lines_modified') continue
    return { row, lines: parseAuditLines(row.metadata) }
  }
  return null
}

type Props = {
  items: OrderItemRow[]
  currencyCode: string
  newTotal: number
  audit: AuditLogRow[]
  supplierName: string
}

export async function SupplierChangesSummary({ items, currencyCode, newTotal, audit, supplierName }: Props) {
  const t = await getTranslations('OrderChangesSummary')
  const locale = normalizeAppLocale(await getLocale())
  const latest = latestModificationAudit(audit)
  const lines = latest?.lines ?? []
  const modifiedAt = latest?.row.created_at

  const previousTotal = lines.length > 0 ? computePreviousOrderTotal(items, lines) : null
  const delta =
    previousTotal != null ? Math.round((newTotal - previousTotal) * 100) / 100 : null

  const lineOldTotal = (ln: AuditLine) => Math.round(ln.old_quantity * ln.old_unit_price * 100) / 100
  const lineNewTotal = (ln: AuditLine) => Math.round(ln.new_quantity * ln.new_unit_price * 100) / 100

  return (
    <section
      className="overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-white shadow-sm ring-1 ring-violet-100"
      aria-labelledby="order-changes-heading"
    >
      <div className="border-b border-violet-100 bg-violet-500/5 px-4 py-4 sm:px-5 sm:py-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm shadow-violet-900/20 sm:h-12 sm:w-12">
            <GitCompareArrows className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="order-changes-heading" className="text-base font-semibold leading-snug text-slate-900 sm:text-lg">
              {t('title')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('subtitle', { name: supplierName })}</p>
            {modifiedAt && (
              <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-violet-700/80">
                {t('proposedAt', { when: formatDateTimeShort(modifiedAt, locale) })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {previousTotal != null && (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-2">
              <div className="flex flex-col justify-center rounded-lg bg-white/90 px-4 py-3 text-center shadow-sm ring-1 ring-slate-100 sm:text-start">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('totalBefore')}</span>
                <span className="mt-1 break-all text-lg font-bold tabular-nums tracking-tight text-slate-900 sm:text-xl">
                  {formatMoney(previousTotal, currencyCode)}
                </span>
              </div>

              <div className="flex items-center justify-center py-0 sm:px-1 sm:py-6" aria-hidden>
                <ArrowDown className="h-5 w-5 text-slate-400 sm:hidden" />
                <ArrowRight className="hidden h-5 w-5 text-slate-400 sm:block" />
              </div>

              <div className="flex flex-col justify-center rounded-lg bg-violet-50 px-4 py-3 text-center shadow-sm ring-1 ring-violet-100 sm:text-end">
                <span className="text-[11px] font-bold uppercase tracking-wide text-violet-800">{t('totalAfter')}</span>
                <span className="mt-1 break-all text-lg font-bold tabular-nums tracking-tight text-violet-950 sm:text-xl">
                  {formatMoney(newTotal, currencyCode)}
                </span>
              </div>
            </div>

            {delta != null && delta !== 0 && (
              <div className="mt-3 flex justify-center sm:justify-end">
                <span
                  className={cn(
                    'inline-flex max-w-full justify-center rounded-full px-3 py-1.5 text-center text-xs font-bold tabular-nums leading-snug sm:inline-flex sm:max-w-none sm:px-3 sm:py-1',
                    delta > 0 ? 'bg-amber-100 text-amber-950' : 'bg-emerald-100 text-emerald-950',
                  )}
                >
                  {delta > 0 ? t('deltaUp', { amount: formatMoney(delta, currencyCode) }) : t('deltaDown', { amount: formatMoney(Math.abs(delta), currencyCode) })}
                </span>
              </div>
            )}
          </div>
        )}

        {lines.length > 0 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('linesHeading', { count: lines.length })}</p>
            <ul className="space-y-4">
              {lines.map((ln) => {
                const oldLt = lineOldTotal(ln)
                const newLt = lineNewTotal(ln)
                const lineDelta = Math.round((newLt - oldLt) * 100) / 100
                return (
                  <li
                    key={ln.order_item_id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/80 sm:p-5"
                  >
                    <p className="break-words text-base font-semibold leading-snug text-slate-900">{ln.product_label}</p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <div className="min-w-0 rounded-lg bg-slate-50 px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{t('before')}</p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-800">
                          {t('qtyPriceLine', {
                            qty: ln.old_quantity,
                            price: formatMoney(ln.old_unit_price, currencyCode),
                          })}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          <span className="text-slate-500">{t('lineTotal')}: </span>
                          <span className="font-semibold tabular-nums text-slate-900">{formatMoney(oldLt, currencyCode)}</span>
                        </p>
                      </div>

                      <div className="relative min-w-0 sm:before:absolute sm:before:inset-y-4 sm:before:start-[-0.625rem] sm:before:w-px sm:before:bg-slate-200">
                        <div className="flex justify-center py-1 sm:hidden" aria-hidden>
                          <ArrowDown className="h-5 w-5 text-violet-400" />
                        </div>
                        <div className="rounded-lg bg-violet-50 px-4 py-3 ring-1 ring-violet-100">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-violet-800">{t('after')}</p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-900">
                            {t('qtyPriceLine', {
                              qty: ln.new_quantity,
                              price: formatMoney(ln.new_unit_price, currencyCode),
                            })}
                          </p>
                          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-violet-950">
                            <span>
                              <span className="text-violet-700/90">{t('lineTotal')}: </span>
                              <span className="font-semibold tabular-nums">{formatMoney(newLt, currencyCode)}</span>
                            </span>
                            {lineDelta !== 0 ? (
                              <span
                                className={cn(
                                  'inline-flex rounded-md px-2 py-0.5 text-xs font-bold tabular-nums',
                                  lineDelta > 0 ? 'bg-amber-100 text-amber-950' : 'bg-emerald-100 text-emerald-950',
                                )}
                              >
                                {lineDelta > 0 ? '+' : ''}
                                {formatMoney(lineDelta, currencyCode)}
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm leading-relaxed text-amber-950 sm:py-4">
            <p>{t('noLineDiff')}</p>
          </div>
        )}
      </div>
    </section>
  )
}
