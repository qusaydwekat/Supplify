import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { BookOpen, CircleDollarSign, FileText, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RetailerFinanceNavKey = 'orders' | 'invoices' | 'payments' | 'ledger'

const ITEMS: { key: RetailerFinanceNavKey; href: string; icon: typeof ShoppingCart }[] = [
  { key: 'orders', href: '/retailer/orders', icon: ShoppingCart },
  { key: 'invoices', href: '/retailer/invoices', icon: FileText },
  { key: 'payments', href: '/retailer/payments', icon: CircleDollarSign },
  { key: 'ledger', href: '/retailer/ledger', icon: BookOpen },
]

type Props = {
  active: RetailerFinanceNavKey
}

export async function RetailerFinanceQuickNav({ active }: Props) {
  const tNav = await getTranslations('Nav')

  const labels: Record<RetailerFinanceNavKey, string> = {
    orders: tNav('myOrders'),
    invoices: tNav('invoices'),
    payments: tNav('payments'),
    ledger: tNav('ledger'),
  }

  return (
    <nav aria-label="Finance" className="-mx-1 flex gap-2 overflow-x-auto pb-1">
      {ITEMS.map(({ key, href, icon: Icon }) => {
        const isActive = key === active
        return (
          <Link
            key={key}
            href={href}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition',
              isActive
                ? 'border-primary/40 bg-primary/15 text-primary shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:border-primary/25 hover:bg-muted/60 hover:text-foreground',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {labels[key]}
          </Link>
        )
      })}
    </nav>
  )
}
