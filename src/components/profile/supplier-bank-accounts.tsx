'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  addSupplierBankAccount,
  deleteSupplierBankAccount,
  setDefaultSupplierBankAccount,
  toggleSupplierBankAccount,
} from '@/lib/actions/bank-accounts'

export type SupplierBankAccountRow = {
  id: string
  bank_name: string
  branch: string | null
  account_holder: string
  iban: string | null
  account_number: string | null
  swift: string | null
  is_default: boolean
  is_active: boolean
  notes: string | null
}

type Props = { accounts: SupplierBankAccountRow[] }

export function SupplierBankAccounts({ accounts }: Props) {
  const t = useTranslations('SupplierBankAccounts')
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    bank_name: '',
    branch: '',
    account_holder: '',
    iban: '',
    account_number: '',
    swift: '',
    is_default: accounts.length === 0,
    notes: '',
  })

  function reset() {
    setForm({
      bank_name: '',
      branch: '',
      account_holder: '',
      iban: '',
      account_number: '',
      swift: '',
      is_default: false,
      notes: '',
    })
  }

  function onAdd(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await addSupplierBankAccount(form)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t('added'))
      reset()
    })
  }

  return (
    <div className="space-y-4">
      {accounts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {accounts.map((acc) => (
            <li
              key={acc.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{acc.bank_name}</span>
                  {acc.branch ? (
                    <span className="text-xs text-muted-foreground">{acc.branch}</span>
                  ) : null}
                  {acc.is_default ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                      {t('default')}
                    </span>
                  ) : null}
                  {!acc.is_active ? (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {t('inactive')}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {acc.account_holder}
                  {acc.iban ? <span className="ms-2 font-mono text-xs">{acc.iban}</span> : null}
                  {!acc.iban && acc.account_number ? (
                    <span className="ms-2 font-mono text-xs">{acc.account_number}</span>
                  ) : null}
                </div>
                {acc.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{acc.notes}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {!acc.is_default ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-8 px-3 py-1 text-xs"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await setDefaultSupplierBankAccount(acc.id)
                        if (res.error) toast.error(res.error)
                        else toast.success(t('updated'))
                      })
                    }
                  >
                    {t('makeDefault')}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-8 px-3 py-1 text-xs"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await toggleSupplierBankAccount(acc.id, !acc.is_active)
                      if (res.error) toast.error(res.error)
                      else toast.success(t('updated'))
                    })
                  }
                >
                  {acc.is_active ? t('disable') : t('enable')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-8 px-3 py-1 text-xs"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(t('confirmDelete'))) return
                    startTransition(async () => {
                      const res = await deleteSupplierBankAccount(acc.id)
                      if (res.error) toast.error(res.error)
                      else toast.success(t('deleted'))
                    })
                  }}
                >
                  {t('delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={onAdd}
        className="space-y-3 rounded-lg border border-border bg-muted/30 p-4"
      >
        <p className="text-sm font-medium text-foreground">{t('addTitle')}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="form-label">{t('bankName')}</label>
            <Input
              className="mt-1.5"
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="form-label">{t('branch')}</label>
            <Input
              className="mt-1.5"
              value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">{t('accountHolder')}</label>
            <Input
              className="mt-1.5"
              value={form.account_holder}
              onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="form-label">{t('iban')}</label>
            <Input
              className="mt-1.5"
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })}
              placeholder="PS92 …"
            />
          </div>
          <div>
            <label className="form-label">{t('accountNumber')}</label>
            <Input
              className="mt-1.5"
              value={form.account_number}
              onChange={(e) => setForm({ ...form, account_number: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">{t('swift')}</label>
            <Input
              className="mt-1.5"
              value={form.swift}
              onChange={(e) => setForm({ ...form, swift: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
        <div>
          <label className="form-label">{t('notes')}</label>
          <Input
            className="mt-1.5"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary"
            checked={form.is_default}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
          />
          <span>{t('makeDefault')}</span>
        </label>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? t('saving') : t('add')}
          </Button>
        </div>
      </form>
    </div>
  )
}
