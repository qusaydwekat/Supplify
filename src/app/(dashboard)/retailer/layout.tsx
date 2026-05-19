import { CartProvider } from '@/components/cart/cart-provider'
import { RetailerCartStack } from '@/components/cart/retailer-cart-stack'

export default function RetailerLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <RetailerCartStack />
      {children}
    </CartProvider>
  )
}
