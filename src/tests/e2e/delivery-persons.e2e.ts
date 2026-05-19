import { test, expect } from '@playwright/test'
import { loginAsSupplier } from './helpers/auth.helper'

const e2eReady = process.env.E2E_ENABLED === '1'

test.describe('Delivery persons', () => {
  test.skip(!e2eReady, 'Set E2E_ENABLED=1 and seed test users to run E2E')

  test('supplier can open delivery persons page', async ({ page }) => {
    await loginAsSupplier(page)
    await page.goto('/supplier/delivery-persons')
    await expect(page.getByRole('heading', { name: /delivery person/i })).toBeVisible()
  })
})
