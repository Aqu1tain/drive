import { request, type APIRequestContext, type Page } from '@playwright/test'

export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
export const OWNER = {
  email: process.env.TEST_OWNER_EMAIL ?? 'owner@example.com',
  password: process.env.TEST_OWNER_PASSWORD ?? 'correct-horse-battery',
  name: 'Owner',
}

export const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

/** An API client that behaves like the app: same Origin, own cookie jar. */
export async function apiAs(email: string, password: string): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { origin: BASE_URL } })
  const setup = await (await api.get('/api/setup')).json()
  if (setup.needed) await api.post('/api/setup', { data: OWNER })
  const response = await api.post('/api/auth/sign-in/email', { data: { email, password } })
  if (!response.ok()) throw new Error(`Sign-in failed for ${email}: ${response.status()}`)
  return api
}

export const ownerApi = () => apiAs(OWNER.email, OWNER.password)

export async function createReader(owner: APIRequestContext, name = 'Lecteur E2E') {
  const email = `${unique('reader')}@example.com`
  const password = 'reader-password-123'
  const response = await owner.post('/api/people', { data: { email, name, password } })
  const { id } = await response.json()
  return { id, email, password, name }
}

export async function createFolder(owner: APIRequestContext, name: string, parentId: string | null = null) {
  const response = await owner.post('/api/folders', { data: { name, parentId } })
  return (await response.json()) as { id: string, name: string }
}

export async function uploadText(owner: APIRequestContext, parentId: string | null, name: string, content: string) {
  const query = new URLSearchParams({ name, ...(parentId ? { parentId } : {}) })
  const response = await owner.put(`/api/uploads?${query}`, { data: Buffer.from(content), headers: { 'content-type': 'text/plain' } })
  return (await response.json()) as { id: string, name: string }
}

export async function removeFolder(owner: APIRequestContext, id: string) {
  await owner.post('/api/resources/trash', { data: { ids: [id] } })
  await owner.delete(`/api/resources/${id}`)
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/^(Adresse email|Email address)$/).fill(email)
  await page.getByLabel(/^(Mot de passe|Password)$/).fill(password)
  await page.getByRole('button', { name: /^(Se connecter|Sign in)$/ }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'))
}
