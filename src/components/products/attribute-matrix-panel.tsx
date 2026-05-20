'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { generateVariationsFromMatrix, saveProductAttributeMatrix } from '@/lib/actions/products-pricing'
import type { ProductAttributeRow } from '@/lib/data/products/attributes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  productId: string
  initialAttributes: ProductAttributeRow[]
}

type DraftAttr = {
  name: string
  optionsText: string
}

function toDraft(attrs: ProductAttributeRow[]): DraftAttr[] {
  if (!attrs.length) return [{ name: '', optionsText: '' }]
  return attrs.map((a) => ({
    name: a.name,
    optionsText: a.options.map((o) => o.value).join(', '),
  }))
}

export function AttributeMatrixPanel({ productId, initialAttributes }: Props) {
  const t = useTranslations('AttributeMatrix')
  const router = useRouter()
  const [draft, setDraft] = useState<DraftAttr[]>(() => toDraft(initialAttributes))
  const [pending, setPending] = useState(false)
  const [generating, setGenerating] = useState(false)

  async function saveAttributes() {
    setPending(true)
    const payload = draft
      .map((d) => ({
        name: d.name.trim(),
        options: d.optionsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }))
      .filter((d) => d.name && d.options.length)

    const res = await saveProductAttributeMatrix(productId, payload)
    setPending(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('saved'))
    router.refresh()
  }

  async function generateSkus() {
    setGenerating(true)
    const saveRes = await saveProductAttributeMatrix(
      productId,
      draft
        .map((d) => ({
          name: d.name.trim(),
          options: d.optionsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }))
        .filter((d) => d.name && d.options.length),
    )
    if (saveRes.error) {
      setGenerating(false)
      toast.error(saveRes.error)
      return
    }

    const res = await generateVariationsFromMatrix(productId)
    setGenerating(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(t('generated', { count: res.created }))
    router.refresh()
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t('title')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('hint')}</p>
      </div>

      <div className="space-y-3">
        {draft.map((row, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('attrName')}</label>
              <Input
                className="mt-1 h-9"
                value={row.name}
                placeholder={t('attrNamePlaceholder')}
                onChange={(e) =>
                  setDraft((prev) => prev.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">{t('attrOptions')}</label>
              <Input
                className="mt-1 h-9"
                value={row.optionsText}
                placeholder={t('attrOptionsPlaceholder')}
                onChange={(e) =>
                  setDraft((prev) => prev.map((r, i) => (i === index ? { ...r, optionsText: e.target.value } : r)))
                }
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-8 px-3 text-xs"
          onClick={() => setDraft((prev) => [...prev, { name: '', optionsText: '' }])}
        >
          {t('addAttribute')}
        </Button>
        <Button type="button" className="h-8 px-3 text-xs" disabled={pending} onClick={() => void saveAttributes()}>
          {pending ? t('saving') : t('save')}
        </Button>
        <Button
          type="button"
          className="h-8 px-3 text-xs"
          variant="secondary"
          disabled={generating}
          onClick={() => void generateSkus()}
        >
          {generating ? t('generating') : t('generateSkus')}
        </Button>
      </div>
    </div>
  )
}
