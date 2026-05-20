'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { createVariation, updateVariation, deleteVariation, adjustStock } from '@/lib/actions/products'
import { AdjustStockModal } from '@/components/products/adjust-stock-modal'
import { PriceTiersEditor } from '@/components/products/price-tiers-editor'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { PriceTier } from '@/lib/pricing/resolve-unit-price'
import { calcMarginPercent, formatMarginPercent, isNegativeMargin } from '@/lib/products/margin'
import { cn } from '@/lib/utils'
import { isVariationLowStock } from '@/lib/types/products'

export type VariationRow = {
  id: string
  name: string
  sku: string | null
  cost_price: number
  price: number
  stock_quantity: number
  min_order_quantity: number
  reorder_point: number | null
  reorder_qty: number | null
  lead_time_days: number | null
  is_active: boolean
}

type RowState = VariationRow & { isNew?: boolean }

type Props = {
  productId: string
  initialRows: VariationRow[]
  initialTiersByVariation?: Record<string, PriceTier[]>
}

export function VariationsTable({ productId, initialRows, initialTiersByVariation = {} }: Props) {
  const t = useTranslations('VariationsTable')
  const router = useRouter()
  const [rows, setRows] = useState<RowState[]>(() => initialRows.map((r) => ({ ...r, isNew: false })))
  const [adjustRow, setAdjustRow] = useState<RowState | null>(null)

  const updateLocal = (index: number, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: '',
        sku: '',
        cost_price: 0,
        price: 0,
        stock_quantity: 0,
        min_order_quantity: 1,
        reorder_point: 2,
        reorder_qty: null,
        lead_time_days: null,
        is_active: true,
        isNew: true,
      },
    ])
  }

  const saveRow = async (index: number) => {
    const row = rows[index]
    if (!row.name.trim()) {
      toast.error(t('nameRequired'))
      return
    }

    const payload = {
      name: row.name,
      sku: row.sku || null,
      cost_price: Number(row.cost_price),
      price: Number(row.price),
      stock_quantity: Number(row.stock_quantity),
      min_order_quantity: Number(row.min_order_quantity),
      reorder_point: row.reorder_point != null ? Number(row.reorder_point) : null,
      reorder_qty: row.reorder_qty != null ? Number(row.reorder_qty) : null,
      lead_time_days: row.lead_time_days != null ? Number(row.lead_time_days) : null,
      is_active: row.is_active,
    }

    if (row.isNew) {
      const res = await createVariation(productId, payload)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t('successCreated'))
    } else {
      const res = await updateVariation(row.id, { ...payload, id: row.id })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(t('successSaved'))
    }
    router.refresh()
  }

  const removeRow = async (index: number) => {
    const row = rows[index]
    if (row.isNew) {
      setRows((prev) => prev.filter((_, i) => i !== index))
      return
    }
    if (!window.confirm(t('deleteConfirm'))) return
    const res = await deleteVariation(row.id)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('successDeleted'))
    router.refresh()
  }

  const quickBump = async (index: number, delta: number) => {
    const row = rows[index]
    if (row.isNew) return
    const res = await adjustStock(row.id, delta, 'count_correction')
    if (res.error) {
      toast.error(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{t('title')}</h3>
        <Button type="button" variant="secondary" onClick={addRow}>
          {t('addVariation')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-start font-medium text-slate-700">{t('colName')}</th>
              <th className="px-3 py-2 text-start font-medium text-slate-700">{t('colSku')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colCost')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colPrice')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colMargin')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colStock')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colMin')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colReorder')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colLeadDays')}</th>
              <th className="px-3 py-2 text-center font-medium text-slate-700">{t('colActive')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colActions')}</th>
              <th className="px-3 py-2 text-end font-medium text-slate-700">{t('colTiers')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rows.map((row, index) => {
              const low = !row.isNew && isVariationLowStock(row.stock_quantity, row.min_order_quantity, row.reorder_point)
              const margin = calcMarginPercent(row.price, row.cost_price)
              const negativeMargin = isNegativeMargin(row.price, row.cost_price)
              return (
                <tr key={row.id} className={cn('hover:bg-slate-50', low && 'bg-amber-50')}>
                  <td className="px-3 py-2">
                    <Input value={row.name} onChange={(e) => updateLocal(index, { name: e.target.value })} className="h-8" />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={row.sku ?? ''}
                      onChange={(e) => updateLocal(index, { sku: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.cost_price}
                      onChange={(e) => updateLocal(index, { cost_price: Number(e.target.value) })}
                      className="h-8 text-end"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={row.price}
                      onChange={(e) => updateLocal(index, { price: Number(e.target.value) })}
                      className="h-8 text-end"
                    />
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-end tabular-nums text-xs font-medium',
                      negativeMargin ? 'text-red-600' : 'text-slate-600',
                    )}
                    title={negativeMargin ? t('negativeMarginHint') : undefined}
                  >
                    {formatMarginPercent(margin)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {!row.isNew && (
                        <>
                          <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => quickBump(index, -1)}>
                            −
                          </Button>
                          <Button type="button" variant="ghost" className="h-8 px-1 text-xs" onClick={() => setAdjustRow(row)}>
                            {t('adjust')}
                          </Button>
                        </>
                      )}
                      <Input
                        type="number"
                        min={0}
                        value={row.stock_quantity}
                        onChange={(e) => updateLocal(index, { stock_quantity: Number(e.target.value) })}
                        className="h-8 w-16 text-end"
                        readOnly={!row.isNew}
                      />
                      {!row.isNew && (
                        <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => quickBump(index, 1)}>
                          +
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      value={row.min_order_quantity}
                      onChange={(e) => updateLocal(index, { min_order_quantity: Number(e.target.value) })}
                      className="h-8 text-end"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      value={row.reorder_point ?? ''}
                      onChange={(e) =>
                        updateLocal(index, { reorder_point: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      className="h-8 w-16 text-end"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      value={row.lead_time_days ?? ''}
                      onChange={(e) =>
                        updateLocal(index, { lead_time_days: e.target.value === '' ? null : Number(e.target.value) })
                      }
                      className="h-8 w-14 text-end"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.is_active}
                      onChange={(e) => updateLocal(index, { is_active: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 text-end">
                    <div className="flex justify-end gap-2">
                      <Button type="button" className="h-8 px-2 text-xs" onClick={() => saveRow(index)}>
                        {t('save')}
                      </Button>
                      <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => removeRow(index)}>
                        {t('delete')}
                      </Button>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {!row.isNew ? (
                      <PriceTiersEditor
                        variationId={row.id}
                        basePrice={row.price}
                        initialTiers={initialTiersByVariation[row.id] ?? []}
                      />
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{t('stockHint')}</p>

      {adjustRow && !adjustRow.isNew ? (
        <AdjustStockModal
          variationId={adjustRow.id}
          variationName={adjustRow.name}
          currentStock={adjustRow.stock_quantity}
          open
          onClose={() => setAdjustRow(null)}
        />
      ) : null}
    </div>
  )
}
