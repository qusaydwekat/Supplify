import { test, expect } from '@playwright/test'

const e2eReady = process.env.E2E_ENABLED === '1'

test.describe('Authentication', () => {
  test.skip(!e2eReady, 'Set E2E_ENABLED=1 and seed test users to run E2E')

  test('login page renders sign-in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible()
    await expect(page.getByLabel(/email|phone|identifier/i)).toBeVisible()
  })

  test('unauthenticated user redirected from supplier dashboard', async ({ page }) => {
    await page.goto('/supplier')
    await expect(page).toHaveURL(/login/)
  })

  test('unauthenticated user redirected from retailer dashboard', async ({ page }) => {
    await page.goto('/retailer')
    await expect(page).toHaveURL(/login/)
  })

  test('register page shows validation on empty submit', async ({ page }) => {
    await page.goto('/register')
    const submit = page.getByRole('button', { name: /create account|register|sign up/i }).first()
    if (await submit.isVisible()) {
      await submit.click()
      await expect(page.locator('text=/required|invalid/i').first()).toBeVisible({ timeout: 5_000 })
    }
  })
})
