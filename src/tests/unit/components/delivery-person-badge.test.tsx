/**
 * DeliveryPersonBadge shows contact info and tel/WhatsApp links.
 */
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { DeliveryPersonBadge } from '@/components/delivery/delivery-person-badge'
import { renderWithIntl } from '@/tests/test-utils/render-intl'

describe('DeliveryPersonBadge', () => {
  const props = { name: 'Ahmad Khalil', phone: '+970 59 000 0000' }

  it('DeliveryPersonBadge_ValidProps_RendersName', () => {
    renderWithIntl(<DeliveryPersonBadge {...props} />)
    expect(screen.getByText(/Ahmad Khalil/)).toBeInTheDocument()
  })

  it('DeliveryPersonBadge_ValidProps_RendersPhone', () => {
    renderWithIntl(<DeliveryPersonBadge {...props} />)
    expect(screen.getByText(/\+970 59 000 0000/)).toBeInTheDocument()
  })

  it('DeliveryPersonBadge_ValidProps_RendersCallLink', () => {
    renderWithIntl(<DeliveryPersonBadge {...props} />)
    const callLink = screen.getByRole('link', { name: /call/i })
    expect(callLink).toHaveAttribute('href', expect.stringContaining('tel:'))
  })

  it('DeliveryPersonBadge_ValidProps_RendersWhatsAppLinkWithDigitsOnly', () => {
    renderWithIntl(<DeliveryPersonBadge {...props} />)
    const waLink = screen.getByRole('link', { name: /whatsapp/i })
    expect(waLink).toHaveAttribute('href', 'https://wa.me/970590000000')
  })
})
