import { createHash, randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BASE_URL, Client, USERCONTENT_URL, ownerClient, readerClient, unique } from './client'

const RESOURCE = `${BASE_URL}/mcp`
const REDIRECT_URI = 'http://127.0.0.1:8976/callback'

let owner: Client
let root: string
const readers: string[] = []

beforeAll(async () => {
  owner = await ownerClient()
  const folder = await owner.post('/api/folders', { name: unique('mcp'), parentId: null })
  expect(folder.status).toBe(201)
  root = folder.body.id
})

afterAll(async () => {
  await owner.post('/api/resources/trash', { ids: [root] })
  await owner.delete(`/api/resources/${root}`)
  for (const id of readers) await owner.delete(`/api/people/${id}`)
})

/** What an AI client does on its own: no cookies, no Origin. */
async function raw(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, { redirect: 'manual', ...init })
  const type = response.headers.get('content-type') ?? ''
  return { status: response.status, headers: response.headers, body: type.includes('json') ? await response.json() : await response.text() }
}

/** A browser navigation gets a 302; Node's fetch always says `sec-fetch-mode: cors`, so Better Auth answers in JSON. */
function redirectOf(response: { status: number, headers: Headers, body: any }) {
  expect([200, 302]).toContain(response.status)
  return new URL(response.headers.get('location') ?? response.body.url, BASE_URL)
}

async function register(name = 'Test AI') {
  const response = await raw('/api/auth/oauth2/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: name, redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }),
  })
  expect(response.status).toBe(201)
  return response.body.client_id as string
}

/** Authorization request with PKCE by `user`, answered on the consent page; returns where the client is sent back. */
async function authorize(user: Client, clientId: string, verifier: string, accept: boolean) {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    state: 'xyz',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    resource: RESOURCE,
  })
  const consentPage = redirectOf(await user.get(`/api/auth/oauth2/authorize?${query}`))
  expect(consentPage.pathname).toBe('/oauth/consent')

  const consent = await user.post('/api/auth/oauth2/consent', { accept, oauth_query: consentPage.search.slice(1) })
  expect(consent.status).toBe(200)
  const callback = new URL(consent.body.url)
  expect(callback.searchParams.get('state')).toBe('xyz')
  return callback
}

async function connect(user: Client, clientId: string) {
  const verifier = randomBytes(32).toString('base64url')
  const callback = await authorize(user, clientId, verifier, true)
  const token = await raw('/api/auth/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: callback.searchParams.get('code')!, code_verifier: verifier, redirect_uri: REDIRECT_URI, client_id: clientId, resource: RESOURCE }),
  })
  expect(token.status).toBe(200)
  return token.body as { access_token: string, refresh_token: string, expires_in: number }
}

let rpcId = 0
function rpc(token: string | null, method: string, params: object = {}) {
  return raw('/mcp', {
    method: 'POST',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json', 'accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
}

async function call(token: string, name: string, args: object = {}) {
  const response = await rpc(token, 'tools/call', { name, arguments: args })
  expect(response.status).toBe(200)
  return response.body as { result?: { isError?: boolean, content: Array<{ type: string, text?: string, data?: string, mimeType?: string }> }, error?: { message: string } }
}

const parsed = (result: Awaited<ReturnType<typeof call>>) => JSON.parse(result.result!.content[0]!.text!)

async function toolNames(token: string) {
  const list = await rpc(token, 'tools/list')
  expect(list.status).toBe(200)
  return (list.body.result.tools as Array<{ name: string }>).map(tool => tool.name).sort()
}

describe('discovery', () => {
  it('publishes the authorization server and the protected resource', async () => {
    for (const path of ['/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server/api/auth']) {
      const metadata = await raw(path)
      expect(metadata.status).toBe(200)
      expect(metadata.body).toMatchObject({
        issuer: `${BASE_URL}/api/auth`,
        authorization_endpoint: `${BASE_URL}/api/auth/oauth2/authorize`,
        token_endpoint: `${BASE_URL}/api/auth/oauth2/token`,
        registration_endpoint: `${BASE_URL}/api/auth/oauth2/register`,
        code_challenge_methods_supported: ['S256'],
      })
    }
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const metadata = await raw(path)
      expect(metadata.status).toBe(200)
      expect(metadata.body).toMatchObject({ resource: RESOURCE, authorization_servers: [`${BASE_URL}/api/auth`] })
    }
  })

  it('asks for a token with a pointer to the metadata', async () => {
    const response = await rpc(null, 'tools/list')
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe(`Bearer resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`)

    const invalid = await rpc('not-a-token', 'tools/list')
    expect(invalid.status).toBe(401)
    expect(invalid.headers.get('www-authenticate')).toContain('error="invalid_token"')
  })

  it('is only served on the app origin', async () => {
    for (const path of ['/mcp', '/.well-known/oauth-protected-resource', '/.well-known/oauth-authorization-server']) {
      expect((await fetch(`${USERCONTENT_URL}${path}`, { method: path === '/mcp' ? 'POST' : 'GET' })).status).toBe(404)
    }
  })

  it('sends people who are signed out through the login page, then to consent', async () => {
    const clientId = await register()
    const query = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: REDIRECT_URI, code_challenge: 'x'.repeat(43), code_challenge_method: 'S256', resource: RESOURCE })
    const login = redirectOf(await raw(`/api/auth/oauth2/authorize?${query}`))
    expect(login.pathname).toBe('/oauth/login')

    const redirect = await raw(`${login.pathname}${login.search}`)
    const page = new URL(redirect.headers.get('location')!, BASE_URL)
    expect(page.pathname).toBe('/login')
    expect(page.searchParams.get('redirect')).toBe(`/oauth/consent${login.search}`)
  })

  it('sends a refusal back to the app without granting anything', async () => {
    const clientId = await register('Denied AI')
    const callback = await authorize(owner, clientId, randomBytes(32).toString('base64url'), false)
    expect(callback.searchParams.get('error')).toBe('access_denied')
    expect(callback.searchParams.get('code')).toBeNull()
    expect((await owner.get('/api/connected-apps')).body.apps.some((app: { clientId: string }) => app.clientId === clientId)).toBe(false)
  })

  it('lets OAuth clients reach the token endpoint from another origin, and nothing else', async () => {
    const token = await raw('/api/auth/oauth2/token', { method: 'POST', headers: { 'origin': 'https://ai.example', 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=authorization_code&code=nope&client_id=nope' })
    expect(token.status).not.toBe(403)
    const consent = await raw('/api/auth/oauth2/consent', { method: 'POST', headers: { 'origin': 'https://ai.example', 'content-type': 'application/json' }, body: '{"accept":true}' })
    expect(consent.status).toBe(403)
  })
})

describe('owner connection', () => {
  let token: string
  let clientId: string

  beforeAll(async () => {
    clientId = await register('Owner AI')
    token = (await connect(owner, clientId)).access_token
  })

  it('offers every tool, with honest annotations', async () => {
    expect(await toolNames(token)).toEqual(['create_folder', 'get_item', 'list_activity', 'list_folder', 'move', 'move_to_trash', 'read_file', 'rename', 'search', 'upload_text_file'])
    const tools = (await rpc(token, 'tools/list')).body.result.tools as Array<{ name: string, annotations: Record<string, boolean> }>
    expect(tools.find(tool => tool.name === 'read_file')!.annotations).toMatchObject({ readOnlyHint: true })
    expect(tools.find(tool => tool.name === 'move_to_trash')!.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true })
  })

  it('lists, searches, reads and organizes', async () => {
    const word = unique('zebra')
    const file = await owner.upload(root, `${word}.txt`, `Notes about ${word} and more`)
    expect(file.status).toBe(201)

    const listing = parsed(await call(token, 'list_folder', { folderId: root }))
    expect(listing.items.map((item: { name: string }) => item.name)).toEqual([`${word}.txt`])
    expect(listing.items[0].url).toBe(`${BASE_URL}/open/${file.body.id}`)

    const top = parsed(await call(token, 'list_folder'))
    expect(top.path).toBe('My Drive')
    expect(top.items.some((item: { id: string }) => item.id === root)).toBe(true)

    const found = parsed(await call(token, 'search', { query: `${word} type:text` }))
    expect(found.results.map((item: { id: string }) => item.id)).toContain(file.body.id)

    const read = await call(token, 'read_file', { id: file.body.id })
    expect(read.result!.content[1]!.text).toBe(`Notes about ${word} and more`)

    const part = await call(token, 'read_file', { id: file.body.id, offset: 6, maxCharacters: 1000 })
    expect(part.result!.content[1]!.text).toBe(`about ${word} and more`)

    const details = parsed(await call(token, 'get_item', { id: file.body.id }))
    expect(details).toMatchObject({ id: file.body.id, sharing: { level: 'private' }, activity: { views: 0 } })

    const created = parsed(await call(token, 'create_folder', { name: 'From AI', folderId: root }))
    expect(created.type).toBe('folder')
    const saved = parsed(await call(token, 'upload_text_file', { name: 'summary.md', content: '# Summary', folderId: created.id }))
    expect(saved).toMatchObject({ name: 'summary.md', size: 9, replaced: false })
    const taken = await call(token, 'upload_text_file', { name: 'summary.md', content: 'again', folderId: created.id })
    expect(taken.result!.isError).toBe(true)

    expect(parsed(await call(token, 'rename', { id: saved.id, name: 'resume.md' })).name).toBe('resume.md')
    expect(parsed(await call(token, 'move', { ids: [file.body.id], folderId: created.id })).moved).toEqual([file.body.id])
    expect(parsed(await call(token, 'move_to_trash', { ids: [saved.id] })).trashed).toEqual([{ id: saved.id, name: 'resume.md' }])
    expect((await owner.get('/api/trash')).body.items.some((item: { id: string }) => item.id === saved.id)).toBe(true)
  })

  it('returns images as images', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#3366ff' } }).png().toBuffer()
    const image = await owner.upload(root, `${unique('pixel')}.png`, png)
    const read = await call(token, 'read_file', { id: image.body.id })
    expect(read.result!.content[1]).toMatchObject({ type: 'image', mimeType: 'image/png', data: png.toString('base64') })
  })

  it('lists and revokes the connected app, which stops working right away', async () => {
    const apps = (await owner.get('/api/connected-apps')).body.apps as Array<{ clientId: string, name: string }>
    expect(apps).toContainEqual(expect.objectContaining({ clientId, name: 'Owner AI' }))

    expect((await owner.delete(`/api/connected-apps/${clientId}`)).status).toBe(200)
    expect((await rpc(token, 'tools/list')).status).toBe(401)
    expect((await owner.get('/api/connected-apps')).body.apps.some((app: { clientId: string }) => app.clientId === clientId)).toBe(false)
    expect((await owner.delete(`/api/connected-apps/${clientId}`)).status).toBe(404)
  })
})

describe('consent', () => {
  it('is required on every request, whichever way it is withdrawn', async () => {
    const clientId = await register('Withdrawn AI')
    const { access_token: token } = await connect(owner, clientId)
    expect((await rpc(token, 'tools/list')).status).toBe(200)

    const consents = (await owner.get('/api/auth/oauth2/get-consents')).body as Array<{ id: string, clientId: string }>
    const consent = consents.find(row => row.clientId === clientId)!
    const deleted = await fetch(`${BASE_URL}/api/auth/oauth2/delete-consent`, {
      method: 'POST',
      headers: { ...owner.headers(), 'origin': BASE_URL, 'content-type': 'application/json' },
      body: JSON.stringify({ id: consent.id }),
    })
    expect(deleted.status).toBe(200)
    expect((await rpc(token, 'tools/list')).status).toBe(401)
  })
})

describe('reader connection', () => {
  it('only reads what is shared, and every read shows up in the journal', async () => {
    const reader = await readerClient(owner)
    readers.push(reader.id)
    const folder = (await owner.post('/api/folders', { name: unique('shared'), parentId: root })).body.id as string
    const notes = await owner.upload(folder, 'notes.txt', 'shared notes')
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#000' } }).png().toBuffer()
    const image = await owner.upload(folder, 'photo.png', png)
    const secret = await owner.upload(root, `${unique('secret')}.txt`, 'owner only')
    await owner.post(`/api/resources/${folder}/access`, { email: reader.email, notify: false })
    await owner.post(`/api/resources/${image.body.id}/access`, { email: reader.email, allowDownload: false, notify: false })
    await owner.patch(`/api/resources/${image.body.id}`, { inheritAccess: false })

    const clientId = await register('Reader AI')
    const { access_token: token } = await connect(reader.client, clientId)
    expect(await toolNames(token)).toEqual(['get_item', 'list_folder', 'read_file', 'search'])

    const top = parsed(await call(token, 'list_folder'))
    expect(top.items.map((item: { id: string }) => item.id)).toContain(folder)
    expect(parsed(await call(token, 'read_file', { id: notes.body.id }))).toMatchObject({ name: 'notes.txt' })
    expect((await call(token, 'read_file', { id: notes.body.id })).result!.content[1]!.text).toBe('shared notes')

    const refusedImage = await call(token, 'read_file', { id: image.body.id })
    expect(refusedImage.result!.isError).toBe(true)
    expect(parsed(refusedImage).error).toContain('Downloading is turned off')

    const forbidden = await call(token, 'read_file', { id: secret.body.id })
    expect(forbidden.result!.isError).toBe(true)
    expect((await call(token, 'get_item', { id: secret.body.id })).result!.isError).toBe(true)

    const ownerTool = await call(token, 'create_folder', { name: 'nope' })
    expect(ownerTool.error ?? ownerTool.result?.isError).toBeTruthy()

    const journal = (await owner.get(`/api/activity?resourceId=${notes.body.id}`)).body.events as Array<{ type: string, actorLabel: string }>
    expect(journal).toContainEqual(expect.objectContaining({ type: 'view', actorLabel: 'Reader via Reader AI' }))

    await owner.patch(`/api/people/${reader.id}`, { status: 'disabled' })
    expect((await rpc(token, 'tools/list')).status).toBe(401)
  })
})
