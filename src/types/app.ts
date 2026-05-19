import type { OrderStatus } from '@/lib/validations/order'

export type DeliveryPerson = {
  id: string
  supplier_id: string
  name: string
  phone: string
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type OrderWithDeliveryPerson = {
  id: string
  delivery_person_id: string | null
  status: OrderStatus
} & {
  delivery_persons: Pick<DeliveryPerson, 'id' | 'name' | 'phone'> | null
}
