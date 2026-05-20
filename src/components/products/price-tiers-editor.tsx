'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { saveVariationPriceTiers } from '@/lib/actions/products-pricing'
import type { PriceTier } from '@/lib/pricing/resolve-unit-price'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  variationId: string
  basePrice: number
  initialTiers: PriceTier[]
}

export function PriceTiersEditor({ variationId, basePrice, initialTiers }: Props) {
  const t = useTranslations('PriceTiers')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<PriceTier[]>(() =>
    initialTiers.length ? initialTiers : [{ minQuantity: 1, unitPrice: basePrice }],
  )
  const [pending, setPending] = useState(false)

  async function save() {
    setPending(true)
    const res = await saveVariationPriceTiers(variationId, rows)
    setPending(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('saved'))
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setOpen(true)}>
        {t('manage', { count: initialTiers.length })}
      </Button>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-700">{t('title')}</p>
      <p className="text-xs text-slate-500">{t('hint')}</p>
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            className="h-8 w-20 text-end"
            value={row.minQuantity}
            onChange={(e) =>
              setRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, minQuantity: Number(e.target.value) } : r)),
              )
            }
          />
          <span className="text-xs text-slate-500">+</span>
          <Input
            type="number"
            step="0.01"
            min={0}
            className="h-8 w-24 text-end"
            value={row.unitPrice}
            onChange={(e) =>
              setRows((prev) =>
                prev.map((r, i) => (i === index ? { ...r, unitPrice: Number(e.target.value) } : r)),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs text-red-600"
            onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
          >
            ×
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-8 px-2 text-xs"
          onClick={() =>
            setRows((prev) => [...prev, { minQuantity: (prev.at(-1)?.minQuantity ?? 1) + 10, unitPrice: basePrice }])
          }
        >
          {t('addTier')}
        </Button>
        <Button type="button" className="h-8 px-2 text-xs" disabled={pending} onClick={() => void save()}>
          {pending ? t('saving') : t('save')}
        </Button>
        <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setOpen(false)}>
          {t('cancel')}
        </Button>
      </div>
    </div>
  )
}
