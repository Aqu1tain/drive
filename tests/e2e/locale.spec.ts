import { expect, test } from '@playwright/test'
import { OWNER } from './helpers'

test.use({ storageState: { cookies: [], origins: [] }, locale: 'en-US' })

test('the interface is in English by default and switches to French from the settings', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await page.getByLabel('Email address').fill(OWNER.email)
  await page.getByLabel('Password').fill(OWNER.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('link', { name: 'My Drive' }).first()).toBeVisible()

  await page.goto('/settings')
  await page.getByLabel('Language').selectOption('fr')
  await expect(page.getByRole('link', { name: 'Mon Drive' }).first()).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await page.getByLabel('Langue').selectOption('en')
  await expect(page.getByRole('link', { name: 'My Drive' }).first()).toBeVisible()
})
