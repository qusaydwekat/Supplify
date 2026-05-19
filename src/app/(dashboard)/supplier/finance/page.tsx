import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { supabaseServer } from '@/lib/supabase/server'
import { PartnerStatementDownloads } from '@/components/supplier/partner-statement-downloads'
import { ExpenseQuickForm } from '@/components/supplier/expense-quick-form'
import { getSupplierTradeTermsPartners } from '@/lib/data/trade-terms-list'
import { formatDateMedium, normalizeAppLocale } from '@/lib/format-datetime'
import {
  defaultFinanceMonthBounds,
  lastNDaysBounds,
  previousMonthBounds,
  priorPeriodBounds,
  utcEndExclusiveAfterInclusiveDay,
  utcStartOfCalendarDay,
  yearToDateBounds,
  ymdUtc,
  type FinanceBounds,
} from '@/lib/supplier-finance-period'

type PresetKey = 'thisMonth' | 'lastMonth' | 'last30' | 'last90' | 'ytd' | 'custom'

type FinanceSearchParams = {
  from?: string
  to?: string
  preset?: string
}

function resolveBounds(sp: FinanceSearchParams): {
  bounds: FinanceBounds
  fromInput: string
  toInput: string
  preset: PresetKey
  invalid: boolean
} {
  const presetParam = (sp.preset ?? '').trim()
  switch (presetParam) {
    case 'lastMonth': {
      const b = previousMonthBounds()
      return { bounds: b, fromInput: ymdUtc(b.from), toInput: ymdUtc(b.lastInclusive), preset: 'lastMonth', invalid: false }
    }
    case 'last30': {
      const b = lastNDaysBounds(30)
      return { bounds: b, fromInput: ymdUtc(b.from), toInput: ymdUtc(b.lastInclusive), preset: 'last30', invalid: false }
    }
    case 'last90': {
      const b = lastNDaysBounds(90)
      return { bounds: b, fromInput: ymdUtc(b.from), toInput: ymdUtc(b.lastInclusive), preset: 'last90', invalid: false }
    }
    case 'ytd': {
      const b = yearToDateBounds()
      return { bounds: b, fromInput: ymdUtc(b.from), toInput: ymdUtc(b.lastInclusive), preset: 'ytd', invalid: false }
    }
  }

  const fromQ = sp.from?.trim()
  const toQ = sp.to?.trim()
  if (fromQ || toQ) {
    if (!fromQ || !toQ) {
      const b = defaultFinanceMonthBounds()
      return { bounds: b, fromInput: ymdUtc(b.from), toInput: ymdUtc(b.lastInclusive), preset: 'thisMonth', invalid: true }
    }
    const f = utcStartOfCalendarDay(fromQ)
    const tStart = utcStartOfCalendarDay(toQ)
    const tEx = utcEndExclusiveAfterInclusiveDay(toQ)
    if (!f || !tStart || !tEx || f.getTime() > tStart.getTime()) {
      const b = defaultFinanceMonthBounds()
      return { bounds: b, fromInput: ymdUtc(b.from), toInput: ymdUtc(b.lastInclusive), preset: 'thisMonth', invalid: true }
    }
    return {
      bounds: { from: f, toExclusive: tEx, lastInclusive: tStart },
      fromInput: fromQ,
      toInput: toQ,
      preset: 'custom',
      invalid: false,
    }
  }

  const b = defaultFinanceMonthBounds()
  return { bounds: b, fromInput: ymdUtc(b.from), toInput: ymdUtc(b.lastInclusive), preset: 'thisMonth', invalid: false }
}

function formatPercent(num: number): string {
  if (!Number.isFinite(num)) return '∞'
  return `${num >= 0 ? '+' : ''}${(num * 100).toFixed(1)}%`
}

export default async function SupplierFinancePage({
  searchParams,
}: {
  searchParams: Promise<FinanceSearchParams>
}) {
  const t = await getTranslations('FinancePage')
  const locale = normalizeAppLocale(await getLocale())
  const sp = await searchParams

  const supabase = supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return <p className="text-sm text-red-600">{t('unauthorized')}</p>

  const { data: supplier } = await supabase.from('suppliers').select('id, currency_code').eq('user_id', user.id).maybeSingle()
  if (!supplier) return <p className="text-sm text-red-600">{t('notSupplier')}</p>

  const ccy = String((supplier as { currency_code?: string }).currency_code ?? 'USD')

  const resolved = resolveBounds(sp)
  const { bounds, fromInput, toInput, preset, invalid: periodInvalid } = resolved
  const prior = priorPeriodBounds(bounds)

  const [{ data: pl }, { data: plPrior }, { data: ledgerCmp }, partnersRes] = await Promise.all([
    supabase.rpc('supplier_profit_and_loss', {
      p_supplier_id: supplier.id,
      p_from: bounds.from.toISOString(),
      p_to: bounds.toExclusive.toISOString(),
    }),
    supabase.rpc('supplier_profit_and_loss', {
      p_supplier_id: supplier.id,
      p_from: prior.from.toISOString(),
      p_to: prior.toExclusive.toISOString(),
    }),
    supabase.rpc('supplier_ledger_journal_totals', { p_supplier_id: supplier.id }),
    getSupplierTradeTermsPartners(),
  ])

  const row = Array.isArray(pl) && pl[0] ? pl[0] : null
  const rowPrior = Array.isArray(plPrior) && plPrior[0] ? plPrior[0] : null
  const cmp = Array.isArray(ledgerCmp) && ledgerCmp[0] ? ledgerCmp[0] : null

  const statementPartners =
    'error' in partnersRes
      ? []
      : partnersRes.partners.map((p) => ({ retailer_id: p.retailer_id, label: p.business_name }))

  const rangeLabelFrom = formatDateMedium(bounds.from.toISOString(), locale)
  const rangeLabelTo = formatDateMedium(bounds.lastInclusive.toISOString(), locale)
  const priorLabelFrom = formatDateMedium(prior.from.toISOString(), locale)
  const priorLabelTo = formatDateMedium(prior.lastInclusive.toISOString(), locale)

  const noiCurrent = row?.net_operating_income != null ? Number(row.net_operating_income) : null
  const noiPrior = rowPrior?.net_operating_income != null ? Number(rowPrior.net_operating_income) : null

  let deltaPct: number | null = null
  let deltaAbs: number | null = null
  if (noiCurrent != null && noiPrior != null) {
    deltaAbs = noiCurrent - noiPrior
    if (Math.abs(noiPrior) > 0.001) {
      deltaPct = deltaAbs / Math.abs(noiPrior)
    }
  }

  const presetButton = (key: PresetKey, labelKey: string) => {
    const active = preset === key
    const href = key === 'thisMonth' ? '/supplier/finance' : `/supplier/finance?preset=${key}`
    return (
      <Link
        href={href}
        className={
          'inline-flex h-9 items-center rounded-md px-3 text-xs font-medium ' +
          (active
            ? 'bg-slate-900 text-white'
            : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50')
        }
      >
        {t(labelKey)}
      </Link>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{t('periodTitle')}</h2>
        {periodInvalid ? <p className="mt-2 text-xs text-amber-800">{t('periodInvalid')}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {presetButton('thisMonth', 'presetThisMonth')}
          {presetButton('lastMonth', 'presetLastMonth')}
          {presetButton('last30', 'presetLast30')}
          {presetButton('last90', 'presetLast90')}
          {presetButton('ytd', 'presetYtd')}
        </div>
        <form method="get" action="/supplier/finance" className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
          <label className="block text-xs text-slate-600">
            {t('periodFrom')}
            <input
              type="date"
              name="from"
              defaultValue={fromInput}
              className="mt-1 block rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-slate-600">
            {t('periodTo')}
            <input
              type="date"
              name="to"
              defaultValue={toInput}
              className="mt-1 block rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            {t('periodApply')}
          </button>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('cardPlNet')}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {noiCurrent != null ? noiCurrent.toFixed(2) : '—'} {ccy}
          </p>
          {deltaAbs != null ? (
            <p
              className={
                'mt-1 text-xs font-medium ' + (deltaAbs >= 0 ? 'text-emerald-700' : 'text-red-700')
              }
            >
              {t('vsPrior', {
                amount: `${deltaAbs >= 0 ? '+' : ''}${deltaAbs.toFixed(2)} ${ccy}`,
                percent: deltaPct != null ? formatPercent(deltaPct) : '—',
              })}
            </p>
          ) : noiPrior != null ? (
            <p className="mt-1 text-xs text-slate-500">{t('vsPriorMissing')}</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">{t('cardPlHintRange', { from: rangeLabelFrom, to: rangeLabelTo })}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
            {t('priorPeriodLabel', { from: priorLabelFrom, to: priorLabelTo })}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-slate-500">{t('cardLedgerJournal')}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-amber-700">{t('cardLedgerAllTime')}</p>
          <p className="mt-2 text-xs text-slate-600">
            {t('ledgerTotal')}: {cmp?.ledger_net != null ? Number(cmp.ledger_net).toFixed(2) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {t('journalAr')}: {cmp?.journal_ar_net != null ? Number(cmp.journal_ar_net).toFixed(2) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {t('journalRev')}: {cmp?.journal_revenue_net != null ? Number(cmp.journal_revenue_net).toFixed(2) : '—'}
          </p>
        </div>
      </section>

      <ExpenseQuickForm currencyCode={ccy} />

      <PartnerStatementDownloads partners={statementPartners} currencyCode={ccy} />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/supplier/reports/profit" className="font-medium text-slate-800 underline-offset-2 hover:underline">
          {t('linkProfit')}
        </Link>
        <Link href="/supplier/ledger" className="font-medium text-slate-800 underline-offset-2 hover:underline">
          {t('linkLedger')}
        </Link>
        <Link href="/supplier/inventory-insights" className="font-medium text-slate-800 underline-offset-2 hover:underline">
          {t('linkInventoryInsights')}
        </Link>
        <Link href="/supplier/trade-terms" className="font-medium text-slate-800 underline-offset-2 hover:underline">
          {t('linkTradeTerms')}
        </Link>
      </div>
    </div>
  )
}
