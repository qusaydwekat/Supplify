'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { markCodCollected } from '@/lib/actions/cod'

type Props = {
  orderId: string
  disabled?: boolean
  /** Server-known state: invoice for this order is already paid (COD recorded). */
  collected?: boolean
}

export function CodCollectButton({ orderId, disabled, collected: collectedProp = false }: Props) {
  const t = useTranslations('Cod')
  const router = useRouter()
  const [pending, start] = useTransition()
  const [collected, setCollected] = useState(collectedProp)

  useEffect(() => {
    setCollected(collectedProp)
  }, [collectedProp])

  if (collected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        {t('alreadyCollected')}
      </span>
    )
  }

  return (
    <Button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const res = await markCodCollected(orderId)
          if (res.error) {
            toast.error(res.error)
            return
          }
          if (res.alreadyCollected) {
            setCollected(true)
            return
          }
          setCollected(true)
          toast.success(t('collectedToast'))
          router.refresh()
        })
      }
    >
      {pending ? t('collecting') : t('confirmCollected')}
    </Button>
  )
}
