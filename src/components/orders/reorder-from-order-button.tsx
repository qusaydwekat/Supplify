'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { getReorderCartPayload } from '@/lib/actions/reorder'
import { useCartContext } from '@/components/cart/cart-provider'
import { cn } from '@/lib/utils'

type Props = {
  orderId: string
  compact?: boolean
}

export function ReorderFromDeliveredOrderButton({ orderId, compact }: Props) {
  const t = useTranslations('Reorder')
  const router = useRouter()
  const { replaceCartWithItems, setOpen } = useCartContext()
  const [loading, setLoading] = useState(false)

  async function onReorder() {
    setLoading(true)
    const r = await getReorderCartPayload(orderId)
    setLoading(false)
    if (r.error) {
      toast.error(r.error)
      return
    }
    if (!r.items?.length || !r.supplierId || !r.supplierLabel) {
      toast.error(t('emptyCart'))
      return
    }
    replaceCartWithItems(r.items, r.supplierId, r.supplierLabel, r.supplierCurrency ?? 'USD')
    if (r.warnings.length) {
      r.warnings.forEach((w) => toast.message(w))
    }
    toast.success(t('cartUpdated'))
    setOpen(true)
    router.push('/retailer/cart')
  }

  return (
    <button
      type="button"
      onClick={() => onReorder()}
      disabled={loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-emerald-600 font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60',
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm',
      )}
    >
      {loading ? (compact ? t('compactLoading') : t('loading')) : t('label')}
    </button>
  )
}
