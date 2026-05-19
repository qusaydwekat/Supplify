'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  deletePalestineBank,
  deletePalestineBranch,
  upsertPalestineBank,
  upsertPalestineBranch,
} from '@/lib/actions/palestine-banks'
import type { PalestineBankRow, PalestineBranchRow } from '@/lib/data/palestine-banks'

type Props = {
  banks: PalestineBankRow[]
  branches: PalestineBranchRow[]
}

type BranchEditDraft = {
  bankId: string
  branchNumber: string
  nameEn: string
  nameAr: string
  city: string
  phone: string
}

export function BanksDirectory({ banks, branches }: Props) {
  const t = useTranslations('BanksDirectoryPage')
  const locale = useLocale()
  const router = useRouter()
  const [pending, start] = useTransition()

  const [newBankEn, setNewBankEn] = useState('')
  const [newBankAr, setNewBankAr] = useState('')
  const [addingForBankId, setAddingForBankId] = useState<string | null>(null)
  const [branchDraft, setBranchDraft] = useState({
    branchNumber: '',
    nameEn: '',
    nameAr: '',
    city: '',
    phone: '',
  })

  const [editingBankId, setEditingBankId] = useState<string | null>(null)
  const [bankEditDraft, setBankEditDraft] = useState({ nameEn: '', nameAr: '' })

  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [branchEditDraft, setBranchEditDraft] = useState<BranchEditDraft>({
    bankId: '',
    branchNumber: '',
    nameEn: '',
    nameAr: '',
    city: '',
    phone: '',
  })

  const brByBank = useMemo(() => {
    const m = new Map<string, PalestineBranchRow[]>()
    for (const br of branches) {
      const arr = m.get(br.bank_id) ?? []
      arr.push(br)
      m.set(br.bank_id, arr)
    }
    return m
  }, [branches])

  const bankLabel = (b: PalestineBankRow) =>
    locale === 'ar' && b.name_ar?.trim() ? b.name_ar.trim() : b.name_en

  function extractError(err: unknown): string {
    if (typeof err === 'string') return err
    if (!err || typeof err !== 'object') return t('saveFailed')
    const o = err as Record<string, unknown>
    if (Array.isArray(o.root)) return (o.root as string[]).join(', ')
    const flat = Object.values(o)
      .flatMap((v) => (Array.isArray(v) ? v : []))
      .filter((x): x is string => typeof x === 'string')
    if (flat.length) return flat.join(', ')
    return t('saveFailed')
  }

  function run(fn: () => Promise<{ error: unknown } | { error: string | null }>) {
    start(async () => {
      const r = await fn()
      const err = 'error' in r ? r.error : null
      if (err != null && err !== '') {
        toast.error(extractError(err))
        return
      }
      toast.success(t('saved'))
      router.refresh()
    })
  }

  function startEditBank(b: PalestineBankRow) {
    setEditingBranchId(null)
    setEditingBankId(b.id)
    setBankEditDraft({ nameEn: b.name_en, nameAr: b.name_ar ?? '' })
    setAddingForBankId(null)
  }

  function startEditBranch(br: PalestineBranchRow) {
    setEditingBankId(null)
    setEditingBranchId(br.id)
    setBranchEditDraft({
      bankId: br.bank_id,
      branchNumber: br.branch_number,
      nameEn: br.name_en,
      nameAr: br.name_ar ?? '',
      city: br.city ?? '',
      phone: br.phone ?? '',
    })
    setAddingForBankId(null)
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">{t('addBank')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('addBankHint')}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            {t('nameEn')}
            <input
              value={newBankEn}
              onChange={(e) => setNewBankEn(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            {t('nameAr')}
            <input
              value={newBankAr}
              onChange={(e) => setNewBankAr(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <Button
          type="button"
          className="mt-3"
          disabled={pending || !newBankEn.trim()}
          onClick={() =>
            run(async () => {
              const r = await upsertPalestineBank({
                nameEn: newBankEn,
                nameAr: newBankAr || undefined,
              })
              if (!r.error) {
                setNewBankEn('')
                setNewBankAr('')
              }
              return r
            })
          }
        >
          {t('saveBank')}
        </Button>
      </section>

      <div className="space-y-6">
        {banks.map((b) => {
          const list = brByBank.get(b.id) ?? []
          const showAdd = addingForBankId === b.id
          const editingBank = editingBankId === b.id

          return (
            <section key={b.id} className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  {editingBank ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-muted-foreground">
                        {t('nameEn')}
                        <input
                          value={bankEditDraft.nameEn}
                          onChange={(e) => setBankEditDraft((d) => ({ ...d, nameEn: e.target.value }))}
                          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        {t('nameAr')}
                        <input
                          value={bankEditDraft.nameAr}
                          onChange={(e) => setBankEditDraft((d) => ({ ...d, nameAr: e.target.value }))}
                          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-base font-semibold text-foreground">{bankLabel(b)}</h3>
                      {locale === 'ar' && b.name_en ? (
                        <p className="text-xs text-muted-foreground">{b.name_en}</p>
                      ) : null}
                      {locale !== 'ar' && b.name_ar ? (
                        <p className="text-xs text-muted-foreground">{b.name_ar}</p>
                      ) : null}
                      {b.is_seed ? (
                        <p className="mt-1 text-xs font-medium text-amber-800">{t('seedBadge')}</p>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingBank ? (
                    <>
                      <Button
                        type="button"
                        disabled={pending || !bankEditDraft.nameEn.trim()}
                        onClick={() =>
                          run(async () => {
                            const r = await upsertPalestineBank({
                              id: b.id,
                              nameEn: bankEditDraft.nameEn,
                              nameAr: bankEditDraft.nameAr || undefined,
                            })
                            if (!r.error) setEditingBankId(null)
                            return r
                          })
                        }
                      >
                        {t('saveChanges')}
                      </Button>
                      <Button type="button" variant="secondary" disabled={pending} onClick={() => setEditingBankId(null)}>
                        {t('cancel')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="secondary" disabled={pending} onClick={() => startEditBank(b)}>
                        {t('editBank')}
                      </Button>
                      {!b.is_seed ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="text-red-700"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm(t('confirmDeleteBank'))) return
                            run(() => deletePalestineBank({ id: b.id }))
                          }}
                        >
                          {t('deleteBank')}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending || editingBranchId !== null}
                        onClick={() => setAddingForBankId(showAdd ? null : b.id)}
                      >
                        {showAdd ? t('cancelAddBranch') : t('addBranch')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {showAdd && !editingBank ? (
                <div className="border-b border-border bg-muted/30 px-4 py-4">
                  <p className="text-xs font-medium text-foreground">{t('newBranch')}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="text-xs text-muted-foreground">
                      {t('branchNumber')}
                      <input
                        value={branchDraft.branchNumber}
                        onChange={(e) => setBranchDraft((d) => ({ ...d, branchNumber: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground sm:col-span-2">
                      {t('branchNameEn')}
                      <input
                        value={branchDraft.nameEn}
                        onChange={(e) => setBranchDraft((d) => ({ ...d, nameEn: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      {t('branchNameAr')}
                      <input
                        value={branchDraft.nameAr}
                        onChange={(e) => setBranchDraft((d) => ({ ...d, nameAr: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      {t('city')}
                      <input
                        value={branchDraft.city}
                        onChange={(e) => setBranchDraft((d) => ({ ...d, city: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      {t('phone')}
                      <input
                        value={branchDraft.phone}
                        onChange={(e) => setBranchDraft((d) => ({ ...d, phone: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <Button
                    type="button"
                    className="mt-3"
                    disabled={
                      pending ||
                      !branchDraft.branchNumber.trim() ||
                      !branchDraft.nameEn.trim()
                    }
                    onClick={() =>
                      run(async () => {
                        const r = await upsertPalestineBranch({
                          bankId: b.id,
                          branchNumber: branchDraft.branchNumber,
                          nameEn: branchDraft.nameEn,
                          nameAr: branchDraft.nameAr || undefined,
                          city: branchDraft.city || undefined,
                          phone: branchDraft.phone || undefined,
                        })
                        if (!r.error) {
                          setBranchDraft({ branchNumber: '', nameEn: '', nameAr: '', city: '', phone: '' })
                          setAddingForBankId(null)
                        }
                        return r
                      })
                    }
                  >
                    {t('saveBranch')}
                  </Button>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/60 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">{t('colBranchNo')}</th>
                      <th className="px-4 py-2">{t('colBranchName')}</th>
                      <th className="px-4 py-2">{t('colCity')}</th>
                      <th className="px-4 py-2">{t('colPhone')}</th>
                      <th className="px-4 py-2">{t('colActions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {list.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                          {t('noBranches')}
                        </td>
                      </tr>
                    ) : (
                      list.map((br) => {
                        const editingRow = editingBranchId === br.id
                        if (editingRow) {
                          return (
                            <tr key={br.id} className="bg-muted/20">
                              <td className="px-4 py-2 align-top">
                                <input
                                  value={branchEditDraft.branchNumber}
                                  onChange={(e) =>
                                    setBranchEditDraft((d) => ({ ...d, branchNumber: e.target.value }))
                                  }
                                  className="w-full min-w-[4rem] rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                                />
                              </td>
                              <td className="px-4 py-2 align-top">
                                <input
                                  value={branchEditDraft.nameEn}
                                  onChange={(e) => setBranchEditDraft((d) => ({ ...d, nameEn: e.target.value }))}
                                  className="mb-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                                  placeholder={t('branchNameEn')}
                                />
                                <input
                                  value={branchEditDraft.nameAr}
                                  onChange={(e) => setBranchEditDraft((d) => ({ ...d, nameAr: e.target.value }))}
                                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                                  placeholder={t('branchNameAr')}
                                />
                              </td>
                              <td className="px-4 py-2 align-top">
                                <input
                                  value={branchEditDraft.city}
                                  onChange={(e) => setBranchEditDraft((d) => ({ ...d, city: e.target.value }))}
                                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="px-4 py-2 align-top">
                                <input
                                  value={branchEditDraft.phone}
                                  onChange={(e) => setBranchEditDraft((d) => ({ ...d, phone: e.target.value }))}
                                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                                />
                              </td>
                              <td className="whitespace-nowrap px-4 py-2 align-top">
                                <div className="flex flex-col gap-1 sm:flex-row">
                                  <Button
                                    type="button"
                                    disabled={
                                      pending ||
                                      !branchEditDraft.branchNumber.trim() ||
                                      !branchEditDraft.nameEn.trim()
                                    }
                                    className="min-h-8 px-2 py-1 text-xs"
                                    onClick={() =>
                                      run(async () => {
                                        const r = await upsertPalestineBranch({
                                          id: br.id,
                                          bankId: branchEditDraft.bankId,
                                          branchNumber: branchEditDraft.branchNumber,
                                          nameEn: branchEditDraft.nameEn,
                                          nameAr: branchEditDraft.nameAr || undefined,
                                          city: branchEditDraft.city || undefined,
                                          phone: branchEditDraft.phone || undefined,
                                        })
                                        if (!r.error) setEditingBranchId(null)
                                        return r
                                      })
                                    }
                                  >
                                    {t('saveChanges')}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={pending}
                                    className="min-h-8 px-2 py-1 text-xs"
                                    onClick={() => setEditingBranchId(null)}
                                  >
                                    {t('cancel')}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        }

                        return (
                          <tr key={br.id}>
                            <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{br.branch_number}</td>
                            <td className="px-4 py-2">
                              {locale === 'ar' && br.name_ar?.trim() ? br.name_ar : br.name_en}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{br.city ?? '—'}</td>
                            <td className="max-w-[160px] truncate px-4 py-2 text-muted-foreground">{br.phone ?? '—'}</td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-1">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="text-xs"
                                  disabled={pending || editingBankId !== null}
                                  onClick={() => startEditBranch(br)}
                                >
                                  {t('edit')}
                                </Button>
                                {!br.is_seed ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="text-xs text-red-700"
                                    disabled={pending}
                                    onClick={() => {
                                      if (!confirm(t('confirmDeleteBranch'))) return
                                      run(() => deletePalestineBranch({ id: br.id }))
                                    }}
                                  >
                                    {t('delete')}
                                  </Button>
                                ) : (
                                  <span className="inline-flex items-center text-xs text-muted-foreground">
                                    {t('directoryBranch')}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
