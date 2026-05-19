import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/lib/validations/order'

const flow: OrderStatus[] = ['pending', 'accepted', 'preparing', 'shipped', 'delivered']

const altEnd: Partial<Record<OrderStatus, 'positive' | 'negative' | 'neutral'>> = {
  rejected: 'negative',
  cancelled: 'neutral',
  modified: 'neutral',
}

export async function OrderTimeline({ status }: { status: OrderStatus }) {
  const t = await getTranslations('OrderTimeline')
  const tOrder = await getTranslations('OrderStatus')

  if (altEnd[status]) {
    const tone = altEnd[status]
    return (
      <div
        className={cn(
          'rounded-xl border px-4 py-3.5 text-sm leading-relaxed sm:px-5 sm:py-4',
          tone === 'negative' && 'border-red-200 bg-red-50 text-red-900',
          tone === 'neutral' && 'border-violet-200 bg-violet-50 text-violet-900',
        )}
      >
        {status === 'modified' && t('modified')}
        {status === 'rejected' && t('rejected')}
        {status === 'cancelled' && t('cancelled')}
      </div>
    )
  }

  const idx = flow.indexOf(status)
  const activeIdx = idx === -1 ? 0 : idx

  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {flow.map((step, i) => (
        <li
          key={step}
          className={cn(
            'rounded-full px-2.5 py-1 font-medium ring-1 ring-inset',
            i < activeIdx && 'bg-slate-200 text-slate-700 ring-slate-300',
            i === activeIdx && 'bg-slate-900 text-white ring-slate-900',
            i > activeIdx && 'bg-white text-slate-400 ring-slate-200',
          )}
        >
          {tOrder(step)}
        </li>
      ))}
    </ol>
  )
}
