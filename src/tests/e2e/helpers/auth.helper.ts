import type { Page } from '@playwright/test'

export const TEST_SUPPLIER = {
  email: process.env.E2E_SUPPLIER_EMAIL ?? 'test-supplier@supplify.test',
  password: process.env.E2E_SUPPLIER_PASSWORD ?? 'TestPassword123!',
}

export const TEST_RETAILER = {
  email: process.env.E2E_RETAILER_EMAIL ?? 'test-retailer@supplify.test',
  password: process.env.E2E_RETAILER_PASSWORD ?? 'TestPassword123!',
}

export async function loginAsSupplier(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/email|phone|identifier/i).fill(TEST_SUPPLIER.email)
  await page.getByLabel(/password/i).fill(TEST_SUPPLIER.password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/\/supplier/, { timeout: 15_000 })
}

export async function loginAsRetailer(page: Page) {
  await page.goto('/login')
  await page.getByLabel(/email|phone|identifier/i).fill(TEST_RETAILER.email)
  await page.getByLabel(/password/i).fill(TEST_RETAILER.password)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/\/retailer/, { timeout: 15_000 })
}
