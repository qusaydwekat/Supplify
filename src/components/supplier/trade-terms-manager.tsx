'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { upsertRetailerSupplierTerms } from '@/lib/actions/trade-terms'
import { formatCurrency } from '@/lib/utils'
import type { TradeTermsPartnerRow } from '@/lib/data/trade-terms-list'

type Props = {
  partners: TradeTermsPartnerRow[]
  currencyCode: string
}

export function TradeTermsManager({ partners, currencyCode }: Props) {
  const t = useTranslations('TradeTermsPage')
  const router = useRouter()
  const [openFor, setOpenFor] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const editing = openFor ? partners.find((p) => p.retailer_id === openFor) : null

  if (!partners.length) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 font-medium text-foreground">{t('colRetailer')}</th>
              <th className="px-3 py-2 font-medium text-foreground">{t('colLedger')}</th>
              <th className="px-3 py-2 font-medium text-foreground">{t('colOpenOrders')}</th>
              <th className="px-3 py-2 font-medium text-foreground">{t('colOverdue')}</th>
              <th className="px-3 py-2 font-medium text-foreground">{t('colCreditLimit')}</th>
              <th className="px-3 py-2 font-medium text-foreground">{t('colTermsDays')}</th>
              <th className="px-3 py-2 font-medium text-foreground">{t('colCreditMode')}</th>
              <th className="px-3 py-2 font-medium text-foreground">{t('colBlocked')}</th>
              <th className="px-3 py-2 font-medium text-foreground" />
            </tr>
          </thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.retailer_id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-foreground">{p.business_name}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{formatCurrency(p.ledger_balance, currencyCode)}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{formatCurrency(p.open_uninvoiced, currencyCode)}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{formatCurrency(p.overdue_balance, currencyCode)}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {p.credit_limit === null ? t('noLimit') : formatCurrency(p.credit_limit, currencyCode)}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{p.payment_terms_days}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.credit_enforcement_mode === 'warn' ? t('creditWarn') : t('creditBlock')}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{p.blocked ? t('yes') : t('no')}</td>
                <td className="px-3 py-2">
                  <Button type="button" variant="secondary" className="min-h-8 px-3 py-1.5 text-xs" onClick={() => setOpenFor(p.retailer_id)}>
                    {t('edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <form
          className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const creditLimit = String(fd.get('creditLimit') ?? '').trim()
            const paymentTermsDays = Number(fd.get('paymentTermsDays'))
            const graceDays = Number(fd.get('graceDays'))
            const blocked = fd.get('blocked') === 'on'
            const creditEnforcementMode = fd.get('creditEnforcementMode') === 'warn' ? 'warn' : 'block'
            start(async () => {
              const r = await upsertRetailerSupplierTerms({
                retailerId: editing.retailer_id,
                creditLimit: creditLimit === '' ? '' : creditLimit,
                paymentTermsDays,
                graceDays,
                blocked,
                creditEnforcementMode,
              })
              if (r.error) toast.error(r.error)
              else {
                toast.success(t('saved'))
                setOpenFor(null)
                router.refresh()
              }
            })
          }}
        >
          <h2 className="text-base font-semibold text-foreground">
            {t('editTitle', { name: editing.business_name })}
          </h2>
          <label className="block text-sm">
            <span className="text-muted-foreground">{t('creditLimitHint')}</span>
            <Input className="mt-1" name="creditLimit" type="text" defaultValue={editing.credit_limit === null ? '' : String(editing.credit_limit)} placeholder={t('creditPlaceholder')} />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">{t('paymentTermsDays')}</span>
            <Input className="mt-1" name="paymentTermsDays" type="number" min={1} max={365} defaultValue={editing.payment_terms_days} required />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">{t('graceDays')}</span>
            <Input className="mt-1" name="graceDays" type="number" min={0} max={90} defaultValue={editing.grace_days} required />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">{t('creditModeLabel')}</span>
            <select
              name="creditEnforcementMode"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              defaultValue={editing.credit_enforcement_mode}
            >
              <option value="block">{t('creditBlock')}</option>
              <option value="warn">{t('creditWarn')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="blocked" defaultChecked={editing.blocked} className="h-4 w-4 rounded border-border" />
            <span className="text-muted-foreground">{t('blockedLabel')}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpenFor(null)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
