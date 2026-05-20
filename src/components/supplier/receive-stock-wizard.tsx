'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { receiveStock, searchSupplierSkusForReceive } from '@/lib/actions/inventory-receive'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Line = {
  variationId: string
  productName: string
  variationName: string
  sku: string | null
  stockQuantity: number
  quantity: number
}

export function ReceiveStockWizard() {
  const t = useTranslations('ReceiveStock')
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [pending, setPending] = useState(false)
  const [referenceNote, setReferenceNote] = useState('')
  const [lines, setLines] = useState<Line[]>([])

  async function onSearch() {
    if (!query.trim()) return
    setSearching(true)
    const res = await searchSupplierSkusForReceive(query)
    setSearching(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    if (!res.rows.length) {
      toast.message(t('noResults'))
      return
    }
    setLines((prev) => {
      const map = new Map(prev.map((l) => [l.variationId, l]))
      for (const row of res.rows) {
        if (!map.has(row.variationId)) {
          map.set(row.variationId, {
            variationId: row.variationId,
            productName: row.productName,
            variationName: row.variationName,
            sku: row.sku,
            stockQuantity: row.stockQuantity,
            quantity: 1,
          })
        }
      }
      return [...map.values()]
    })
  }

  async function onSubmit() {
    const payload = lines.filter((l) => l.quantity > 0)
    if (!payload.length) {
      toast.error(t('needLines'))
      return
    }
    setPending(true)
    const res = await receiveStock({
      referenceNote,
      lines: payload.map((l) => ({ variationId: l.variationId, quantity: l.quantity })),
    })
    setPending(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('success', { units: res.received }))
    setLines([])
    setReferenceNote('')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <label className="text-sm font-medium text-foreground">{t('searchLabel')}</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <Input
            className="min-w-[min(100%,16rem)] flex-1"
            value={query}
            placeholder={t('searchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onSearch()
            }}
          />
          <Button type="button" variant="secondary" disabled={searching} onClick={() => void onSearch()}>
            {searching ? t('searching') : t('search')}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <label className="text-sm font-medium text-foreground">{t('referenceLabel')}</label>
        <Input
          className="mt-2"
          value={referenceNote}
          placeholder={t('referencePlaceholder')}
          onChange={(e) => setReferenceNote(e.target.value)}
        />
      </div>

      {lines.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-4 py-3 text-start font-semibold">{t('colProduct')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('colSku')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('colOnHand')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('colReceive')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {lines.map((line) => (
                <tr key={line.variationId}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{line.productName}</div>
                    <div className="text-xs text-muted-foreground">{line.variationName}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{line.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-end tabular-nums">{line.stockQuantity}</td>
                  <td className="px-4 py-3 text-end">
                    <Input
                      type="number"
                      min={0}
                      className="ms-auto h-9 w-24 text-end"
                      value={line.quantity}
                      onChange={(e) => {
                        const quantity = Math.max(0, Number(e.target.value) || 0)
                        setLines((prev) =>
                          prev.map((l) => (l.variationId === line.variationId ? { ...l, quantity } : l)),
                        )
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-red-600"
                      onClick={() => setLines((prev) => prev.filter((l) => l.variationId !== line.variationId))}
                    >
                      {t('remove')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" disabled={pending || !lines.length} onClick={() => void onSubmit()}>
          {pending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </div>
  )
}
