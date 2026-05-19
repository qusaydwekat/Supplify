'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Paperclip, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { sendOrderMessage } from '@/lib/actions/order-messages'
import { cn } from '@/lib/utils'

type Props = {
  orderId: string
  className?: string
}

export function SendOrderMessageForm({ orderId, className }: Props) {
  const t = useTranslations('OrderMessages')
  const router = useRouter()
  const [pending, start] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  return (
    <form
      ref={formRef}
      className={cn('border-t border-slate-200/80 bg-white p-3 sm:p-4', className)}
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        start(async () => {
          const r = await sendOrderMessage(fd)
          if (r.error) {
            toast.error(r.error)
            return
          }
          toast.success(t('sent'))
          formRef.current?.reset()
          const ta = bodyRef.current
          if (ta) {
            ta.style.height = ''
          }
          router.refresh()
        })
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`body-${orderId}`} className="sr-only">
            {t('messageLabel')}
          </label>
          <textarea
            ref={bodyRef}
            id={`body-${orderId}`}
            name="body"
            rows={1}
            className="max-h-36 min-h-[44px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-snug text-slate-900 shadow-inner shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-teal-400/80 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
            placeholder={t('messagePlaceholder')}
            disabled={pending}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = '0'
              el.style.height = `${Math.min(el.scrollHeight, 144)}px`
            }}
          />
        </div>

        <input
          ref={fileRef}
          name="file"
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={pending}
        />

        <Button
          type="button"
          variant="secondary"
          className="h-11 w-11 shrink-0 rounded-xl border-slate-200 p-0"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          aria-label={t('attachFile')}
        >
          <Paperclip className="h-5 w-5 text-slate-600" aria-hidden />
        </Button>

        <Button type="submit" disabled={pending} className="h-11 w-11 shrink-0 rounded-xl p-0 shadow-md" aria-label={t('send')}>
          <SendHorizontal className="h-5 w-5" aria-hidden />
        </Button>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">{t('attachmentHint')}</p>
    </form>
  )
}
