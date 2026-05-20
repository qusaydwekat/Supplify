export type ProductHubTab = 'overview' | 'skus' | 'stock' | 'activity'

export const PRODUCT_HUB_TABS: ProductHubTab[] = ['overview', 'skus', 'stock', 'activity']

export function parseProductHubTab(raw: string | undefined): ProductHubTab {
  if (raw === 'skus' || raw === 'stock' || raw === 'activity') return raw
  return 'overview'
}
