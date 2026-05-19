import { getOrderMessages } from '@/lib/data/order-messages'
import { OrderMessagesRealtime } from '@/components/orders/order-messages-realtime'

type Props = {
  orderId: string
}

/** Loads initial thread server-side; live updates use Supabase Realtime in the client. */
export async function OrderMessagesBlock({ orderId }: Props) {
  const res = await getOrderMessages(orderId)
  const messages = 'error' in res ? [] : res
  return <OrderMessagesRealtime orderId={orderId} initialMessages={messages} />
}
