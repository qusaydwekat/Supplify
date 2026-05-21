import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/charts/chart-skeleton'

export const MiniRevenueChart = dynamic(
  () => import('@/components/charts/mini-revenue-chart').then((m) => m.MiniRevenueChart),
  { loading: () => <ChartSkeleton height={220} /> },
)

export const OrderStatusChart = dynamic(
  () => import('@/components/charts/order-status-chart').then((m) => m.OrderStatusChart),
  { loading: () => <ChartSkeleton height={200} /> },
)

export const RetailerSpendChart = dynamic(
  () => import('@/components/charts/retailer-spend-chart').then((m) => m.RetailerSpendChart),
  { loading: () => <ChartSkeleton height={220} /> },
)

export const RetailerInvoiceStatusChart = dynamic(
  () => import('@/components/charts/retailer-invoice-status-chart').then((m) => m.RetailerInvoiceStatusChart),
  { loading: () => <ChartSkeleton height={200} /> },
)

export const ProfitChart = dynamic(
  () => import('@/components/charts/profit-chart').then((m) => m.ProfitChart),
  { loading: () => <ChartSkeleton height={280} /> },
)

export const ProductProfitTable = dynamic(
  () => import('@/components/charts/product-profit-table').then((m) => m.ProductProfitTable),
  { loading: () => <ChartSkeleton height={320} /> },
)

export const LowMarginAlerts = dynamic(
  () => import('@/components/charts/low-margin-alerts').then((m) => m.LowMarginAlerts),
  { loading: () => <ChartSkeleton height={120} /> },
)

export const RevenueChart = dynamic(
  () => import('@/components/charts/revenue-chart').then((m) => m.RevenueChart),
  { loading: () => <ChartSkeleton height={280} /> },
)

export const TopProductsChart = dynamic(
  () => import('@/components/charts/top-products-chart').then((m) => m.TopProductsChart),
  { loading: () => <ChartSkeleton height={280} /> },
)

export const BalanceOverview = dynamic(
  () => import('@/components/charts/balance-overview').then((m) => m.BalanceOverview),
  { loading: () => <ChartSkeleton height={240} /> },
)
