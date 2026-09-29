import { createHash, randomBytes } from 'node:crypto'
import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test'
import { BASE_URL, OWNER, createReader, ownerApi, signIn } from './helpers'

const REDIRECT_URI = 'http://127.0.0.1:8976/callback'

let owner: APIRequestContext

test.use({ storageState: { cookies: [], origins: [] }, locale: 'en-US' })

test.beforeAll(async () => {
  owner = await ownerApi()
})

/** What an AI client opens in the browser once it has registered itself, anonymously. */
async function authorizationUrl(name: string) {
  const client = await request.newContext({ baseURL: BASE_URL })
  const registration = await client.post('/api/auth/oauth2/register', {
    data: { client_name: name, redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' },
  })
  const { client_id } = await registration.json()
  await client.dispose()
  const verifier = randomBytes(32).toString('base64url')
  return `/api/auth/oauth2/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id,
    redirect_uri: REDIRECT_URI,
    state: 'e2e',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    resource: `${BASE_URL}/mcp`,
  })}`
}

async function signInFromConsent(page: Page, email: string, password: string) {
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/oauth\/consent\?/)
}

test('the owner signs in, reads what the app may do, and allows it', async ({ page }) => {
  await page.goto(await authorizationUrl('E2E Assistant'))
  await signInFromConsent(page, OWNER.email, OWNER.password)

  await expect(page.getByRole('heading', { name: 'E2E Assistant wants to access your Drive' })).toBeVisible()
  await expect(page.getByText('Organize your drive')).toBeVisible()
  await expect(page.getByText('127.0.0.1:8976')).toBeVisible()

  const callback = page.waitForRequest(request => request.url().startsWith(REDIRECT_URI))
  await page.getByRole('button', { name: 'Allow' }).click()
  const url = new URL((await callback).url())
  expect(url.searchParams.get('code')).toBeTruthy()
  expect(url.searchParams.get('state')).toBe('e2e')
})

test('a reader is told the app can only read, and can deny', async ({ page }) => {
  const reader = await createReader(owner)
  await page.goto(await authorizationUrl('E2E Reader Assistant'))
  await signInFromConsent(page, reader.email, reader.password)

  await expect(page.getByText('See, search and read what has been shared with you.')).toBeVisible()
  await expect(page.getByText('Organize your drive')).toHaveCount(0)

  const callback = page.waitForRequest(request => request.url().startsWith(REDIRECT_URI))
  await page.getByRole('button', { name: 'Deny' }).click()
  expect(new URL((await callback).url()).searchParams.get('error')).toBe('access_denied')
  await owner.delete(`/api/people/${reader.id}`)
})

test('an expired or forged request is refused', async ({ page }) => {
  await signIn(page, OWNER.email, OWNER.password)
  await page.goto('/oauth/consent?client_id=forged')
  await expect(page.getByRole('heading', { name: 'This request is no longer valid' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Allow' })).toHaveCount(0)
})
