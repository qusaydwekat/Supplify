/**
 * OrderStatusBadge renders translated labels for each order status.
 */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { OrderStatusBadge } from '@/components/orders/order-status-badge'
import { orderStatuses } from '@/lib/validations/order'
import { renderWithIntl } from '@/tests/test-utils/render-intl'

const labels: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  modified: 'Modified',
  rejected: 'Rejected',
  preparing: 'Preparing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

describe('OrderStatusBadge', () => {
  for (const status of orderStatuses) {
    it(`OrderStatusBadge_${status}_RendersLabel`, () => {
      renderWithIntl(<OrderStatusBadge status={status} />)
      expect(screen.getByText(labels[status])).toBeInTheDocument()
    })
  }
})
