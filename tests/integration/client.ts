export const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
export const USERCONTENT_URL = process.env.TEST_USERCONTENT_URL ?? 'http://127.0.0.1:3000'
export const OWNER = {
  email: process.env.TEST_OWNER_EMAIL ?? 'owner@example.com',
  password: process.env.TEST_OWNER_PASSWORD ?? 'correct-horse-battery',
  name: 'Owner',
}

export interface Response<T = any> {
  status: number
  headers: Headers
  body: T
}

/** A tiny browser stand-in: keeps cookies and sends the app Origin like the real UI does. */
export class Client {
  private cookies = new Map<string, string>()

  constructor(private readonly origin = BASE_URL) {}

  async request<T = any>(method: string, path: string, options: { json?: unknown, body?: BodyInit, headers?: Record<string, string>, base?: string } = {}): Promise<Response<T>> {
    const headers: Record<string, string> = { origin: this.origin, ...options.headers }
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    let body = options.body
    if (options.json !== undefined) {
      headers['content-type'] = 'application/json'
      body = JSON.stringify(options.json)
    }
    const response = await fetch(`${options.base ?? BASE_URL}${path}`, { method, headers, body, redirect: 'manual' })
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const index = pair!.indexOf('=')
      this.cookies.set(pair!.slice(0, index), pair!.slice(index + 1))
    }
    const type = response.headers.get('content-type') ?? ''
    const parsed = type.includes('application/json') ? await response.json() : await response.text()
    return { status: response.status, headers: response.headers, body: parsed as T }
  }

  get<T = any>(path: string, options?: { headers?: Record<string, string>, base?: string }) {
    return this.request<T>('GET', path, options)
  }

  post<T = any>(path: string, json?: unknown) {
    return this.request<T>('POST', path, { json: json ?? {} })
  }

  patch<T = any>(path: string, json: unknown) {
    return this.request<T>('PATCH', path, { json })
  }

  put<T = any>(path: string, json: unknown) {
    return this.request<T>('PUT', path, { json })
  }

  delete<T = any>(path: string) {
    return this.request<T>('DELETE', path)
  }

  upload<T = any>(parentId: string | null, name: string, content: string | Uint8Array, conflict = 'fail') {
    const query = new URLSearchParams({ name, conflict, ...(parentId ? { parentId } : {}) })
    return this.request<T>('PUT', `/api/uploads?${query}`, { body: content as BodyInit })
  }

  async signIn(email: string, password: string) {
    const response = await this.post('/api/auth/sign-in/email', { email, password })
    if (response.status !== 200) throw new Error(`Sign-in failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`)
    return this
  }
}

export async function ownerClient() {
  const client = new Client()
  const setup = await client.get('/api/setup')
  if (setup.body.needed) await client.post('/api/setup', OWNER)
  return client.signIn(OWNER.email, OWNER.password)
}

export const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export async function readerClient(owner: Client, name = 'Reader') {
  const email = `${unique('reader')}@example.com`
  const password = 'reader-password-123'
  const created = await owner.post('/api/people', { email, name, password })
  if (created.status !== 201) throw new Error(`Reader creation failed: ${JSON.stringify(created.body)}`)
  const client = await new Client().signIn(email, password)
  return { client, email, password, id: created.body.id as string }
}
