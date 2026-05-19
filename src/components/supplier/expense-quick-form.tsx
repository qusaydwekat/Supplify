'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createExpense } from '@/lib/actions/expenses'

export function ExpenseQuickForm({ currencyCode }: { currencyCode: string }) {
  const t = useTranslations('FinancePage')
  const router = useRouter()
  const [pending, start] = useTransition()
  const [category, setCategory] = useState('general')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const n = Number(amount)
          if (!Number.isFinite(n) || n <= 0) {
            toast.error(t('expenseAmountInvalid'))
            return
          }
          const r = await createExpense({
            category,
            amount: n,
            currency_code: currencyCode,
            description: description.trim() || undefined,
          })
          if (r.error) toast.error(r.error)
          else {
            toast.success(t('expenseSaved'))
            setAmount('')
            setDescription('')
            router.refresh()
          }
        })
      }}
    >
      <h2 className="text-sm font-semibold text-foreground">{t('expenseTitle')}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          {t('expenseCategory')}
          <Input className="mt-1" value={category} onChange={(e) => setCategory(e.target.value)} required />
        </label>
        <label className="text-xs text-muted-foreground">
          {t('expenseAmount')} ({currencyCode})
          <Input
            className="mt-1"
            type="number"
            step="0.01"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>
      </div>
      <label className="text-xs text-muted-foreground">
        {t('expenseDescription')}
        <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <Button type="submit" disabled={pending} className="h-9 text-sm">
        {t('expenseSubmit')}
      </Button>
    </form>
  )
}
