import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/** The suite reads the French interface; tests/e2e/locale.spec.ts covers the English default. */
const french = { cookies: [{ name: 'drive_locale', value: 'fr', domain: new URL(baseURL).hostname, path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const }], origins: [] }

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    storageState: french,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
})
