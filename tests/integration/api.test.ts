import { unzipSync } from 'fflate'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { docx, pack, pdf } from '../fixtures'
import { Client, USERCONTENT_URL, ownerClient, readerClient, unique } from './client'

let owner: Client
let root: string

beforeAll(async () => {
  owner = await ownerClient()
  const folder = await owner.post('/api/folders', { name: unique('it'), parentId: null })
  expect(folder.status).toBe(201)
  root = folder.body.id
})

afterAll(async () => {
  await owner.post('/api/resources/trash', { ids: [root] })
  await owner.delete(`/api/resources/${root}`)
  const { people } = (await owner.get('/api/people')).body as { people: Array<{ id: string, kind: string, email: string }> }
  for (const person of people.filter(p => /^(reader|invitee|guest)-/.test(p.email))) {
    await (person.kind === 'user' ? owner.delete(`/api/people/${person.id}`) : owner.delete(`/api/invitations/${person.id}`))
  }
})

async function folderIn(parentId: string, name = unique('folder')) {
  const response = await owner.post('/api/folders', { name, parentId })
  expect(response.status).toBe(201)
  return response.body.id as string
}

async function fileIn(parentId: string, name = `${unique('file')}.txt`, content = 'hello') {
  const response = await owner.upload(parentId, name, content)
  expect(response.status).toBe(201)
  return response.body as { id: string, name: string, mimeType: string, kind: string }
}

describe('file operations', () => {
  it('creates, lists, renames, stars and moves', async () => {
    const a = await folderIn(root, 'A')
    const b = await folderIn(root, 'B')
    const file = await fileIn(a, 'rapport.txt')

    const listing = await owner.get(`/api/folders/${a}`)
    expect(listing.body.items.map((i: { name: string }) => i.name)).toEqual(['rapport.txt'])
    expect(listing.body.breadcrumbs.at(-1).name).toBe('A')

    const renamed = await owner.patch(`/api/resources/${file.id}`, { name: 'rapport final.txt', starred: true })
    expect(renamed.body).toMatchObject({ name: 'rapport final.txt', starred: true })

    const moved = await owner.post('/api/resources/move', { ids: [file.id], targetId: b })
    expect(moved.status).toBe(200)
    expect((await owner.get(`/api/folders/${b}`)).body.items).toHaveLength(1)
    expect((await owner.get(`/api/folders/${a}`)).body.items).toHaveLength(0)
  })

  it('refuses duplicate names and offers to keep both', async () => {
    const folder = await folderIn(root)
    await fileIn(folder, 'rapport.pdf', 'one')
    const conflict = await owner.upload(folder, 'Rapport.pdf', 'two')
    expect(conflict.status).toBe(409)
    expect(conflict.body.data.reason).toBe('name_taken')

    const kept = await owner.upload(folder, 'rapport.pdf', 'two', 'keep')
    expect(kept.body.name).toBe('rapport (1).pdf')

    const replaced = await owner.upload(folder, 'rapport.pdf', 'three!', 'replace')
    expect(replaced.status).toBe(200)
    expect(replaced.body.size).toBe(6)
  })

  it('moves a folder with its whole subtree and refuses cycles', async () => {
    const parent = await folderIn(root)
    const child = await folderIn(parent)
    const deep = await fileIn(child)
    const target = await folderIn(root)

    expect((await owner.post('/api/resources/move', { ids: [parent], targetId: child })).status).toBe(400)
    expect((await owner.post('/api/resources/move', { ids: [parent], targetId: target })).status).toBe(200)

    const details = await owner.get(`/api/resources/${deep.id}`)
    expect(details.body.path.map((c: { id: string }) => c.id)).toEqual([null, root, target, parent, child])
  })

  it('trashes, restores and deletes permanently', async () => {
    const folder = await folderIn(root)
    const file = await fileIn(folder)

    await owner.post('/api/resources/trash', { ids: [folder] })
    expect((await owner.get(`/api/folders/${root}`)).body.items.some((i: { id: string }) => i.id === folder)).toBe(false)
    expect((await owner.get('/api/trash')).body.items.some((i: { id: string }) => i.id === folder)).toBe(true)
    expect((await owner.delete(`/api/resources/${root}`)).status).toBe(409)

    const restored = await owner.post('/api/resources/restore', { ids: [folder] })
    expect(restored.body.restored[0]).toMatchObject({ id: folder, movedToRoot: false })
    expect((await owner.get(`/api/folders/${folder}`)).body.items[0].id).toBe(file.id)

    await owner.post('/api/resources/trash', { ids: [folder] })
    expect((await owner.delete(`/api/resources/${folder}`)).status).toBe(200)
    expect((await owner.get(`/api/resources/${file.id}`)).status).toBe(404)
  })

  it('restores an item at the root when its folder is still in the trash', async () => {
    const folder = await folderIn(root)
    const file = await fileIn(folder)
    await owner.post('/api/resources/trash', { ids: [file.id] })
    await owner.post('/api/resources/trash', { ids: [folder] })
    const restored = await owner.post('/api/resources/restore', { ids: [file.id] })
    expect(restored.body.restored[0]).toMatchObject({ movedToRoot: true, parentId: null })
    await owner.post('/api/resources/trash', { ids: [file.id] })
    await owner.delete(`/api/resources/${file.id}`)
  })

  it('searches by name, folder name and type', async () => {
    const folder = await folderIn(root, unique('Facturation'))
    const pdf = await owner.upload(folder, `${unique('Facture')}.pdf`, '%PDF-1.4\n%fake')
    const search = await owner.get(`/api/search?q=${encodeURIComponent(pdf.body.name.slice(0, 14))}`)
    expect(search.body.items.map((i: { id: string }) => i.id)).toContain(pdf.body.id)

    const byFolder = await owner.get(`/api/search?q=${encodeURIComponent(folder)}`)
    expect(byFolder.status).toBe(200)

    const byType = await owner.get(`/api/search?q=${encodeURIComponent(`type:pdf in:${folder}`)}`)
    expect(byType.body.items.map((i: { id: string }) => i.id)).toEqual([pdf.body.id])
  })
})

describe('zip downloads', () => {
  async function zipOf(client: Client, path: string) {
    const response = await fetch(`${process.env.TEST_BASE_URL ?? 'http://localhost:3000'}${path}`, { headers: client.headers() })
    expect(response.status, path).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/zip')
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()))
    return Object.fromEntries(Object.entries(files).map(([name, data]) => [name, new TextDecoder().decode(data)]))
  }

  it('packs a folder with its tree, empty folders included, trash excluded', async () => {
    const folder = await folderIn(root, 'Camp')
    await fileIn(folder, 'programme.txt', 'programme')
    const admin = await folderIn(folder, 'Administratif')
    await fileIn(admin, 'fiche.txt', 'fiche')
    await folderIn(folder, 'Vide')
    const trashed = await fileIn(folder, 'jete.txt', 'jete')
    await owner.post('/api/resources/trash', { ids: [trashed.id] })

    expect(await zipOf(owner, `/api/resources/${folder}/download`)).toEqual({
      'Camp/programme.txt': 'programme',
      'Camp/Administratif/fiche.txt': 'fiche',
      'Camp/Vide/': '',
    })
  })

  it('packs a multiple selection', async () => {
    const a = await fileIn(root, `${unique('a')}.txt`, 'A')
    const b = await fileIn(root, `${unique('b')}.txt`, 'B')
    const files = await zipOf(owner, `/api/downloads?ids=${a.id},${b.id}`)
    expect(files).toEqual({ [a.name]: 'A', [b.name]: 'B' })
  })

  it('only gives readers what they may read and download', async () => {
    const { client: reader, email } = await readerClient(owner)
    const folder = await folderIn(root, 'Partage')
    await fileIn(folder, 'libre.txt', 'libre')
    const hidden = await fileIn(folder, 'cache.txt', 'cache')
    const viewOnly = await fileIn(folder, 'lecture.txt', 'lecture')
    await owner.post(`/api/resources/${folder}/access`, { email, notify: false })
    await owner.patch(`/api/resources/${hidden.id}`, { inheritAccess: false })
    await owner.patch(`/api/resources/${viewOnly.id}`, { inheritAccess: false })
    await owner.post(`/api/resources/${viewOnly.id}/access`, { email, allowDownload: false, notify: false })

    expect(await zipOf(reader, `/api/resources/${folder}/download`)).toEqual({ 'Partage/libre.txt': 'libre' })
    expect((await reader.get(`/api/downloads?ids=${hidden.id}`)).status).toBe(403)
    expect((await reader.get(`/api/downloads?ids=${viewOnly.id}`)).status).toBe(403)
  })

  it('works through a public folder link and refuses malformed selections', async () => {
    const folder = await folderIn(root, 'Public')
    await fileIn(folder, 'infos.txt', 'infos')
    const { link } = (await owner.put(`/api/resources/${folder}/link`, { enabled: true })).body
    const token = new URL(link.url).pathname.split('/').at(-1)!
    expect(await zipOf(new Client(), `/api/s/${token}/downloads?ids=${folder}`)).toEqual({ 'Public/infos.txt': 'infos' })
    expect((await owner.get('/api/downloads?ids=../../etc')).status).toBe(400)
  })
})

describe('multipart uploads', () => {
  const PART = 8 * 1024 * 1024

  async function session(name: string, size: number, conflict = 'fail', parentId = root) {
    return owner.post('/api/uploads/sessions', { parentId, name, size, conflict })
  }

  function part(id: string, number: number, body: Uint8Array) {
    return owner.request('PUT', `/api/uploads/sessions/${id}/parts/${number}`, { body: body as BodyInit })
  }

  it('assembles a large file sent in ordered parts', async () => {
    const data = new Uint8Array(PART + 1000)
    data.set(new TextEncoder().encode('%PDF-1.7\n'), 0)
    data[PART + 999] = 42
    const created = await session(`${unique('big')}.pdf`, data.byteLength)
    expect(created.status).toBe(201)
    expect(created.body.partSize).toBe(PART)
    const id = created.body.id

    expect((await part(id, 2, data.subarray(PART))).status).toBe(409)
    expect((await part(id, 1, data.subarray(0, 1000))).status).toBe(400)
    expect((await part(id, 1, data.subarray(0, PART))).body).toMatchObject({ received: PART, nextPart: 2 })
    expect((await owner.get(`/api/uploads/sessions/${id}`)).body).toMatchObject({ nextPart: 2, received: PART })
    expect((await part(id, 2, data.subarray(PART))).status).toBe(200)

    const done = await owner.post(`/api/uploads/sessions/${id}/complete`)
    expect(done.status).toBe(201)
    expect(done.body).toMatchObject({ size: data.byteLength, mimeType: 'application/pdf' })
    expect((await owner.get(`/api/uploads/sessions/${id}`)).status).toBe(404)

    const tail = await owner.get(`/api/resources/${done.body.id}/content`, { headers: { range: `bytes=${PART + 999}-${PART + 999}` } })
    expect(tail.status).toBe(206)
    expect(tail.headers.get('content-range')).toBe(`bytes ${PART + 999}-${PART + 999}/${data.byteLength}`)
  })

  it('refuses to complete an unfinished upload, and forgets aborted ones', async () => {
    const created = await session(`${unique('partial')}.bin`, PART + 1)
    const id = created.body.id
    expect((await owner.post(`/api/uploads/sessions/${id}/complete`)).status).toBe(400)
    expect((await owner.delete(`/api/uploads/sessions/${id}`)).status).toBe(200)
    expect((await part(id, 1, new Uint8Array(PART))).status).toBe(404)
  })

  it('checks conflicts and quota before any byte is sent', async () => {
    const name = `${unique('dup')}.txt`
    await fileIn(root, name)
    expect((await session(name, 10)).status).toBe(409)
    expect((await session(unique('huge'), Number.MAX_SAFE_INTEGER)).status).toBe(413)
  })
})

describe('file processing', () => {
  const word = () => unique('mot').replace(/-/g, '')
  const searchIds = async (client: Client, q: string) =>
    ((await client.get(`/api/search?q=${encodeURIComponent(q)}`)).body.items as Array<{ id: string }>).map(item => item.id)

  async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const value = await read()
      if (done(value)) return value
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Processing did not finish in time')
  }

  it('indexes the text of a PDF and renders its first page as a thumbnail', async () => {
    const secret = word()
    const file = (await owner.upload(root, `${unique('facture')}.pdf`, pdf('Facture', [`Prestation ${secret}`]))).body
    await eventually(() => searchIds(owner, secret.slice(0, -2)), ids => ids.includes(file.id))

    const { item } = (await owner.get(`/api/resources/${file.id}`)).body
    expect(item.thumbnailUrl).toMatch(/\/thumbnail\?v=/)
    const thumbnail = await owner.get(item.thumbnailUrl)
    expect(thumbnail.headers.get('content-type')).toBe('image/webp')
  })

  it('previews an office document on the isolated origin, without scripts or remote content', async () => {
    const secret = word()
    const file = (await owner.upload(root, `${unique('compte-rendu')}.docx`, await docx(['Compte rendu', secret]))).body
    expect(file.kind).toBe('document')
    const info = await eventually(async () => (await owner.post(`/api/resources/${file.id}/open`)).body, body => !!body.frameUrl)
    expect(info.frameUrl.startsWith(USERCONTENT_URL)).toBe(true)

    const frame = await new Client().get(new URL(info.frameUrl).pathname, { base: USERCONTENT_URL })
    expect(frame.status).toBe(200)
    expect(frame.body).toContain(`<p>${secret}</p>`)
    const policy = frame.headers.get('content-security-policy')!
    expect(policy).toMatch(/^sandbox allow-popups/)
    expect(policy).not.toContain('allow-scripts')
    expect(policy).toContain("default-src 'none'; img-src data:;")
    expect(await searchIds(owner, secret)).toContain(file.id)
  })

  it('never lets readers find text in files they cannot open', async () => {
    const { client: reader, email } = await readerClient(owner)
    const shared = await folderIn(root, 'Lecture')
    const secret = word()
    const visible = await fileIn(shared, `${unique('visible')}.txt`, `note ${secret}`)
    const hidden = await fileIn(root, `${unique('cache')}.txt`, `note ${secret}`)
    await owner.post(`/api/resources/${shared}/access`, { email, notify: false })

    await eventually(() => searchIds(owner, secret), ids => ids.includes(visible.id) && ids.includes(hidden.id))
    expect(await searchIds(reader, secret)).toEqual([visible.id])
  })

  it('stores a video frame sent by the owner as the thumbnail, re-encoded', async () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode('ftypmp42'), 0, 0, 0, 0, ...new TextEncoder().encode('mp42isom')])
    const video = (await owner.upload(root, `${unique('clip')}.mp4`, mp4)).body
    expect(video.kind).toBe('video')
    const frame = await sharp({ create: { width: 64, height: 36, channels: 3, background: '#6d4aff' } }).png().toBuffer()
    const put = (client: Client, id: string, body: Uint8Array) => client.request('PUT', `/api/resources/${id}/thumbnail`, { body: body as BodyInit })

    const saved = await put(owner, video.id, frame)
    expect(saved.status).toBe(200)
    const thumbnail = await owner.get(saved.body.thumbnailUrl)
    expect(thumbnail.headers.get('content-type')).toBe('image/webp')

    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><image href="http://example.com/x.png"/></svg>')
    expect((await put(owner, video.id, svg)).status).toBe(400)
    const text = await fileIn(root)
    expect((await put(owner, text.id, frame)).status).toBe(404)
    const { client: reader } = await readerClient(owner)
    expect((await put(reader, video.id, frame)).status).toBe(403)
  })

  it('publishes a zipped static site, file by file, on the isolated origin only', async () => {
    const zip = await pack({
      'monsite/index.html': '<link rel="stylesheet" href="style.css"><h1>Accueil</h1>',
      'monsite/style.css': 'h1 { color: rebeccapurple }',
      'monsite/blog/index.html': '<h1>Blog</h1>',
      'monsite/mes images/photo 1.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
      '__MACOSX/monsite/._index.html': 'junk',
    })
    const site = (await owner.upload(root, `${unique('site')}.zip`, zip)).body
    const info = await eventually(async () => (await owner.post(`/api/resources/${site.id}/open`)).body, body => !!body.frameUrl)
    expect(info.item.kind).toBe('html')
    const base = new URL(info.frameUrl).pathname
    const visitor = new Client()
    const get = (path: string) => visitor.get(`${base}${path}`, { base: USERCONTENT_URL })

    const home = await get('')
    expect(home.body).toContain('<h1>Accueil</h1>')
    expect(home.headers.get('content-security-policy')).toMatch(/^sandbox allow-popups/)
    const css = await get('style.css')
    expect(css.headers.get('content-type')).toBe('text/css')
    expect(css.headers.get('access-control-allow-origin')).toBe('*')
    const folder = await get('blog')
    expect(folder.status).toBe(302)
    expect(folder.headers.get('location')).toBe(`${base}blog/`)
    expect((await get('blog/')).body).toContain('<h1>Blog</h1>')
    expect((await get('mes%20images/photo%201.svg')).headers.get('content-type')).toBe('image/svg+xml')
    expect((await get('__MACOSX/monsite/._index.html')).status).toBe(404)
    expect((await get('..%2Fmonsite%2Fstyle.css')).status).toBe(404)
    expect((await owner.get(`${base}style.css`)).status).toBe(404)

    const { link } = (await owner.put(`/api/resources/${site.id}/link`, { enabled: true })).body
    expect(link.publishedUrl).toMatch(/\/p\/[\w-]+\/$/)
    const published = new URL(link.publishedUrl).pathname
    expect((await visitor.get(`${published}blog/`, { base: USERCONTENT_URL })).body).toContain('<h1>Blog</h1>')
  })

  it('leaves ordinary archives alone', async () => {
    const archive = (await owner.upload(root, `${unique('photos')}.zip`, await pack({ 'a.txt': 'a', 'b/c.txt': 'c' }))).body
    await eventually(async () => (await owner.get(`/api/resources/${archive.id}`)).body.item, () => true)
    await new Promise(resolve => setTimeout(resolve, 300))
    const info = (await owner.post(`/api/resources/${archive.id}/open`)).body
    expect(info).toMatchObject({ kind: 'archive', frameUrl: null })
  })

  it('forgets the text of a replaced version', async () => {
    const [before, after] = [word(), word()]
    const name = `${unique('version')}.txt`
    const file = await fileIn(root, name, before)
    await eventually(() => searchIds(owner, before), ids => ids.includes(file.id))
    expect((await owner.upload(root, name, after, 'replace')).status).toBe(200)
    await eventually(() => searchIds(owner, after), ids => ids.includes(file.id))
    expect(await searchIds(owner, before)).not.toContain(file.id)
  })
})

describe('languages', () => {
  it('answers in the language picked by the visitor, English otherwise', async () => {
    const missing = '/api/resources/00000000-0000-4000-8000-000000000000'
    expect((await owner.get(missing)).body.statusMessage).toBe('Item not found')
    expect((await owner.get(missing, { headers: { cookie: 'drive_locale=fr' } })).body.statusMessage).toBe('Élément introuvable')
    expect((await owner.get(missing, { headers: { cookie: 'drive_locale=xx' } })).body.statusMessage).toBe('Item not found')
  })
})

describe('upload safety', () => {
  it('neutralises path traversal in names', async () => {
    const file = await fileIn(root, '../../../etc/passwd')
    expect(file.name).toBe('..-..-..-etc-passwd')
  })

  it('trusts file signatures over extensions', async () => {
    const exe = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF])
    const response = await owner.upload(root, `${unique('photo')}.jpg`, exe)
    expect(response.body.mimeType).not.toMatch(/^image\//)
  })

  it('never serves active HTML or SVG from the app origin', async () => {
    const html = await fileIn(root, `${unique('page')}.html`, '<script>alert(1)</script>')
    const content = await owner.get(`/api/resources/${html.id}/content`)
    expect(content.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(content.headers.get('content-security-policy')).toContain('sandbox')

    const svg = await fileIn(root, `${unique('image')}.svg`, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    const svgContent = await owner.get(`/api/resources/${svg.id}/content`)
    expect(svgContent.headers.get('content-security-policy')).toContain('sandbox')
    expect(svgContent.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('serves HTML previews only on the isolated origin, sandboxed', async () => {
    const html = await fileIn(root, `${unique('page')}.html`, '<h1>Bonjour</h1><script>alert(1)</script>')
    const opened = await owner.post(`/api/resources/${html.id}/open`)
    expect(opened.body.frameUrl.startsWith(USERCONTENT_URL)).toBe(true)

    const frame = await new Client().get(new URL(opened.body.frameUrl).pathname, { base: USERCONTENT_URL })
    expect(frame.status).toBe(200)
    expect(frame.headers.get('content-security-policy')).toMatch(/^sandbox allow-popups/)
    expect(frame.headers.get('set-cookie')).toBeNull()

    expect((await new Client().get('/api/me', { base: USERCONTENT_URL })).status).toBe(404)
    expect((await owner.get(new URL(opened.body.frameUrl).pathname)).status).toBe(404)
  })

  it('rejects forged frame tokens', async () => {
    const response = await new Client().get('/c/eyJyIjoiYWJjIn0.forged/', { base: USERCONTENT_URL })
    expect(response.status).toBe(403)
  })
})

describe('folder previews', () => {
  const png = (color: string) => sharp({ create: { width: 32, height: 32, channels: 3, background: color } }).png().toBuffer()
  const previewsOf = async (client: Client, parentId: string, folderId: string) =>
    ((await client.get(`/api/folders/${parentId}`)).body.items as Array<{ id: string, previews?: string[] }>).find(item => item.id === folderId)?.previews ?? []

  async function until<T>(read: () => Promise<T>, done: (value: T) => boolean) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const value = await read()
      if (done(value)) return value
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Thumbnails were not ready in time')
  }

  it('shows the latest images of a folder, never documents or trashed files', async () => {
    const parent = await folderIn(root, 'Albums')
    const album = await folderIn(parent, 'Vacances')
    const photos = []
    for (const color of ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff']) photos.push((await owner.upload(album, `${unique('photo')}.png`, await png(color))).body)
    await fileIn(album, 'notes.txt', 'pas une image')
    await owner.post('/api/resources/trash', { ids: [photos[4].id] })

    const previews = await until(() => previewsOf(owner, parent, album), list => list.length === 4)
    expect(previews.every(url => /\/api\/resources\/[\w-]+\/thumbnail\?v=/.test(url))).toBe(true)
    expect(previews.some(url => url.includes(photos[4].id))).toBe(false)
    expect((await owner.get(previews[0]!)).headers.get('content-type')).toBe('image/webp')
  })

  it('only shows readers images they can open', async () => {
    const { client: reader, email } = await readerClient(owner)
    const shared = await folderIn(root, 'Partage photos')
    const album = await folderIn(shared, 'Album')
    const visible = (await owner.upload(album, `${unique('visible')}.png`, await png('#ff00ff'))).body
    const hidden = (await owner.upload(album, `${unique('cachee')}.png`, await png('#000000'))).body
    await owner.patch(`/api/resources/${hidden.id}`, { inheritAccess: false })
    await owner.post(`/api/resources/${shared}/access`, { email, notify: false })

    await until(() => previewsOf(owner, shared, album), list => list.length === 2)
    const previews = await previewsOf(reader, shared, album)
    expect(previews).toHaveLength(1)
    expect(previews[0]).toContain(visible.id)
  })

  it('looks into subfolders, direct images first, never below a trashed or closed subfolder', async () => {
    const { client: reader, email } = await readerClient(owner)
    const parent = await folderIn(root, 'Camps')
    const camp = await folderIn(parent, 'Camp ski')
    const days = await folderIn(camp, 'Jour 1')
    const closed = await folderIn(camp, 'Encadrants')
    const trashed = await folderIn(camp, 'Brouillons')
    const deep = (await owner.upload(days, `${unique('piste')}.png`, await png('#112233'))).body
    const direct = (await owner.upload(camp, `${unique('affiche')}.png`, await png('#445566'))).body
    const hidden = (await owner.upload(closed, `${unique('staff')}.png`, await png('#778899'))).body
    const gone = (await owner.upload(trashed, `${unique('brouillon')}.png`, await png('#aabbcc'))).body
    await owner.patch(`/api/resources/${closed}`, { inheritAccess: false })
    await owner.post('/api/resources/trash', { ids: [trashed] })
    await owner.post(`/api/resources/${parent}/access`, { email, notify: false })

    const previews = await until(() => previewsOf(owner, parent, camp), list => list.length === 3)
    expect(previews[0]).toContain(direct.id)
    expect(previews.some(url => url.includes(gone.id))).toBe(false)
    expect(previews.some(url => url.includes(hidden.id))).toBe(true)

    const seen = await previewsOf(reader, parent, camp)
    expect(seen.map(url => url.split('/')[3])).toEqual([direct.id, deep.id])
  })
})

describe('version history', () => {
  const history = async (id: string) => (await owner.get(`/api/resources/${id}/versions`)).body
  const text = async (url: string) => (await owner.get(url)).body as string

  it('follows the closest folder that decided, and stores nothing when a folder matches its parent', async () => {
    const parent = await folderIn(root, 'Contrats')
    const child = await folderIn(parent, 'Signés')
    expect((await owner.get(`/api/resources/${child}`)).body.versioning).toEqual({ enabled: false, source: null })

    await owner.patch(`/api/resources/${parent}`, { versioning: true })
    expect((await owner.get(`/api/resources/${child}`)).body.versioning).toMatchObject({ enabled: true, source: { id: parent } })

    await owner.patch(`/api/resources/${child}`, { versioning: false })
    expect((await owner.get(`/api/resources/${child}`)).body.versioning).toMatchObject({ enabled: false, source: { id: child } })
    await owner.patch(`/api/resources/${child}`, { versioning: true })
    expect((await owner.get(`/api/resources/${child}`)).body.versioning).toMatchObject({ enabled: true, source: { id: parent } })

    const file = await fileIn(parent)
    expect((await owner.patch(`/api/resources/${file.id}`, { versioning: true })).status).toBe(400)
  })

  it('keeps what a replaced file held, restores without losing anything, and names versions', async () => {
    const folder = await folderIn(root, 'Versions')
    await owner.patch(`/api/resources/${folder}`, { versioning: true })
    const name = `${unique('devis')}.txt`
    const file = await fileIn(folder, name, 'premier jet')
    await owner.upload(folder, name, 'second jet', 'replace')
    await owner.upload(folder, name, 'second jet', 'replace')
    await owner.upload(folder, name, 'version finale', 'replace')

    let versions = (await history(file.id)).versions as Array<{ id: string, contentUrl: string, downloadUrl: string, label: string | null }>
    expect(versions).toHaveLength(2)
    expect(await text(versions[0]!.contentUrl)).toBe('second jet')
    expect(await text(versions[1]!.contentUrl)).toBe('premier jet')
    expect((await owner.get(versions[1]!.downloadUrl)).headers.get('content-disposition')).toContain('attachment')

    const restored = await owner.post(`/api/resources/${file.id}/versions/${versions[1]!.id}/restore`)
    expect(restored.status).toBe(200)
    expect(await text(`/api/resources/${file.id}/content`)).toBe('premier jet')
    versions = (await history(file.id)).versions
    expect(await Promise.all(versions.map(version => text(version.contentUrl)))).toEqual(expect.arrayContaining(['version finale', 'second jet']))
    expect(versions).toHaveLength(2)

    const named = await owner.patch(`/api/resources/${file.id}/versions/${versions[0]!.id}`, { label: '  Envoyée au client ' })
    expect(named.body.label).toBe('Envoyée au client')
    expect((await history(file.id)).versions[0].label).toBe('Envoyée au client')

    expect((await owner.delete(`/api/resources/${file.id}/versions/${versions[1]!.id}`)).status).toBe(200)
    expect((await history(file.id)).versions).toHaveLength(1)
    expect((await owner.get(versions[1]!.contentUrl)).status).toBe(404)
  })

  it('replaces for good where versions are off, and counts kept versions in the storage', async () => {
    const plain = await folderIn(root, 'Sans versions')
    const name = `${unique('note')}.txt`
    const file = await fileIn(plain, name, 'a')
    await owner.upload(plain, name, 'b', 'replace')
    expect((await history(file.id)).versions).toEqual([])

    const before = (await owner.get('/api/storage')).body.used
    await owner.patch(`/api/resources/${plain}`, { versioning: true })
    await owner.upload(plain, name, 'ccccc', 'replace')
    expect((await history(file.id)).totalSize).toBe(1)
    expect((await owner.get('/api/storage')).body.used).toBe(before + 5)
  })

  it('stays with the owner, and goes with the file', async () => {
    const { client: reader, email } = await readerClient(owner)
    const folder = await folderIn(root, 'Partagé versionné')
    await owner.patch(`/api/resources/${folder}`, { versioning: true })
    const name = `${unique('plan')}.txt`
    const file = await fileIn(folder, name, 'v1')
    await owner.upload(folder, name, 'v2', 'replace')
    await owner.post(`/api/resources/${folder}/access`, { email, notify: false })
    const [version] = (await history(file.id)).versions
    expect((await reader.get(`/api/resources/${file.id}/versions`)).status).toBe(403)
    expect((await reader.get(version.contentUrl)).status).toBe(403)
    expect((await reader.get(`/api/resources/${file.id}`)).body.versioning).toBeUndefined()

    await owner.post('/api/resources/trash', { ids: [file.id] })
    await owner.delete(`/api/resources/${file.id}`)
    expect((await owner.get(version.contentUrl)).status).toBe(404)
  })
})

describe('tags', () => {
  const created: string[] = []
  afterAll(async () => {
    for (const id of created) await owner.delete(`/api/tags/${id}`)
  })

  const newTag = async (name: string) => {
    const response = await owner.post('/api/tags', { name })
    expect(response.status).toBe(201)
    created.push(response.body.id)
    return response.body as { id: string, name: string, color: string }
  }

  it('labels a selection, filters search and survives deletion of the tag', async () => {
    const urgent = await newTag(`  Urgent ${unique('t')}  `)
    expect(urgent.name).toMatch(/^Urgent t-/)
    expect((await owner.post('/api/tags', { name: urgent.name.toUpperCase() })).status).toBe(409)
    const later = await newTag(`À relancer ${unique('t')}`)

    const [a, b] = [await fileIn(root), await fileIn(root)]
    const tagged = await owner.post('/api/resources/tags', { ids: [a.id, b.id], add: [urgent.id, later.id] })
    expect(tagged.body.items).toHaveLength(2)
    await owner.post('/api/resources/tags', { ids: [b.id], remove: [later.id] })

    const listing = (await owner.get(`/api/folders/${root}`)).body.items as Array<{ id: string, tagIds: string[] }>
    expect(listing.find(item => item.id === a.id)!.tagIds.toSorted()).toEqual([urgent.id, later.id].toSorted())
    expect(listing.find(item => item.id === b.id)!.tagIds).toEqual([urgent.id])

    const search = async (q: string) => ((await owner.get(`/api/search?q=${encodeURIComponent(q)}`)).body.items as Array<{ id: string }>).map(item => item.id)
    expect(await search(`tag:"${later.name}"`)).toEqual([a.id])
    expect((await search(`tag:"${urgent.name}"`)).toSorted()).toEqual([a.id, b.id].toSorted())

    const counted = (await owner.get('/api/tags')).body.tags.find((tag: { id: string }) => tag.id === urgent.id)
    expect(counted.count).toBe(2)

    expect((await owner.delete(`/api/tags/${urgent.id}`)).status).toBe(200)
    expect((await owner.get(`/api/resources/${b.id}`)).body.item.tagIds).toEqual([])
    expect(await search(`tag:"${urgent.name}"`)).toEqual([])
  })

  it('stays private to the owner', async () => {
    const { client: reader, email } = await readerClient(owner)
    const tag = await newTag(unique('secret'))
    const file = await fileIn(root)
    await owner.post(`/api/resources/${file.id}/access`, { email, notify: false })
    await owner.post('/api/resources/tags', { ids: [file.id], add: [tag.id] })

    expect((await reader.get(`/api/resources/${file.id}`)).body.item.tagIds).toBeUndefined()
    expect((await reader.get(`/api/search?q=${encodeURIComponent(`tag:${tag.name}`)}`)).body.items).toEqual([])
    expect((await reader.get('/api/tags')).status).toBe(403)
    expect((await reader.post('/api/resources/tags', { ids: [file.id], remove: [tag.id] })).status).toBe(403)
    expect((await reader.post('/api/tags', { name: 'pirate' })).status).toBe(403)
  })
})

describe('reader favorites', () => {
  it('lets a reader star what they can read, for themselves only', async () => {
    const [paul, marie] = [await readerClient(owner), await readerClient(owner)]
    const folder = await folderIn(root, 'Favoris')
    const file = await fileIn(folder, `${unique('plan')}.txt`)
    for (const reader of [paul, marie]) await owner.post(`/api/resources/${folder}/access`, { email: reader.email, notify: false })

    expect((await paul.client.put(`/api/resources/${file.id}/star`, { starred: true })).status).toBe(200)
    const listing = await paul.client.get(`/api/folders/${folder}`)
    expect(listing.body.items.find((item: { id: string }) => item.id === file.id).starred).toBe(true)
    expect((await paul.client.get('/api/starred')).body.items.map((item: { id: string }) => item.id)).toEqual([file.id])

    expect((await marie.client.get('/api/starred')).body.items).toEqual([])
    expect((await marie.client.get(`/api/folders/${folder}`)).body.items[0].starred).toBe(false)
    expect((await owner.get(`/api/resources/${file.id}`)).body.item.starred).toBe(false)
  })

  it('never reveals a favorite whose access is gone', async () => {
    const { client: reader, email } = await readerClient(owner)
    const hidden = await fileIn(root, `${unique('prive')}.txt`)
    expect((await reader.put(`/api/resources/${hidden.id}/star`, { starred: true })).status).toBe(403)

    const shared = await fileIn(root, `${unique('partage')}.txt`)
    const share = await owner.post(`/api/resources/${shared.id}/access`, { email, notify: false })
    await reader.put(`/api/resources/${shared.id}/star`, { starred: true })
    expect((await reader.get('/api/starred')).body.items).toHaveLength(1)
    await owner.delete(`/api/access/${share.body.ruleId}`)
    expect((await reader.get('/api/starred')).body.items).toEqual([])
  })
})

describe('readers', () => {
  it('see only what is shared with them, and can never write', async () => {
    const { client: reader, email } = await readerClient(owner, 'Paul')
    const shared = await folderIn(root, unique('Dupont'))
    const inside = await fileIn(shared, 'devis.txt', 'devis')
    const secret = await fileIn(root, 'secret.txt', 'secret')

    expect((await reader.get(`/api/resources/${inside.id}`)).status).toBe(403)
    const share = await owner.post(`/api/resources/${shared}/access`, { email, notify: false })
    expect(share.status).toBe(201)

    const mine = await reader.get('/api/shared-with-me')
    expect(mine.body.items.map((i: { id: string }) => i.id)).toContain(shared)
    const listing = await reader.get(`/api/folders/${shared}`)
    expect(listing.body.items.map((i: { id: string }) => i.id)).toEqual([inside.id])
    expect(listing.body.breadcrumbs[0].name).toBe('Shared with me')
    expect(listing.body.items[0].access).toBeUndefined()

    expect((await reader.get(`/api/resources/${inside.id}/content`)).body).toBe('devis')
    expect((await reader.get(`/api/resources/${inside.id}/download`)).status).toBe(200)

    expect((await reader.get(`/api/resources/${secret.id}`)).status).toBe(403)
    expect((await reader.get(`/api/resources/${secret.id}/content`)).status).toBe(403)
    expect((await reader.get(`/api/folders/${root}`)).status).toBe(403)
    expect((await reader.get('/api/folders/root')).status).toBe(403)

    expect((await reader.patch(`/api/resources/${inside.id}`, { name: 'hacked.txt' })).status).toBe(403)
    expect((await reader.post('/api/resources/trash', { ids: [inside.id] })).status).toBe(403)
    expect((await reader.upload(shared, 'evil.txt', 'x')).status).toBe(403)
    expect((await reader.post('/api/folders', { name: 'x', parentId: shared })).status).toBe(403)
    expect((await reader.post(`/api/resources/${inside.id}/access`, { email: 'friend@example.com' })).status).toBe(403)
    expect((await reader.put(`/api/resources/${inside.id}/link`, { enabled: true })).status).toBe(403)
    expect((await reader.get('/api/people')).status).toBe(403)
    expect((await reader.get('/api/activity')).status).toBe(403)

    const search = await reader.get('/api/search?q=secret')
    expect(search.body.items.map((i: { id: string }) => i.id)).not.toContain(secret.id)
    const found = await reader.get('/api/search?q=devis')
    expect(found.body.items.map((i: { id: string }) => i.id)).toContain(inside.id)

    await reader.post(`/api/resources/${inside.id}/open`)
    const recent = await reader.get('/api/recent')
    expect(recent.body.items.map((i: { id: string }) => i.id)).toContain(inside.id)
  })

  it('cannot download a view-only share', async () => {
    const { client: reader, email } = await readerClient(owner)
    const file = await fileIn(root)
    await owner.post(`/api/resources/${file.id}/access`, { email, allowDownload: false, notify: false })
    expect((await reader.get(`/api/resources/${file.id}/content`)).status).toBe(200)
    expect((await reader.get(`/api/resources/${file.id}/download`)).status).toBe(403)
  })

  it('lose access immediately on revocation, expiry or account deactivation', async () => {
    const { client: reader, email, id } = await readerClient(owner)
    const file = await fileIn(root)
    const share = await owner.post(`/api/resources/${file.id}/access`, { email, notify: false })
    expect((await reader.get(`/api/resources/${file.id}`)).status).toBe(200)

    await owner.delete(`/api/access/${share.body.ruleId}`)
    expect((await reader.get(`/api/resources/${file.id}`)).status).toBe(403)

    const again = await owner.post(`/api/resources/${file.id}/access`, { email, notify: false })
    await owner.patch(`/api/access/${again.body.ruleId}`, { expiresAt: new Date(Date.now() - 1000).toISOString() })
    expect((await reader.get(`/api/resources/${file.id}`)).status).toBe(403)

    await owner.patch(`/api/access/${again.body.ruleId}`, { expiresAt: null })
    expect((await reader.get(`/api/resources/${file.id}`)).status).toBe(200)
    await owner.patch(`/api/people/${id}`, { status: 'disabled' })
    expect((await reader.get(`/api/resources/${file.id}`)).status).toBe(401)
  })

  it('lose access to what the owner trashes', async () => {
    const { client: reader, email } = await readerClient(owner)
    const file = await fileIn(root)
    await owner.post(`/api/resources/${file.id}/access`, { email, notify: false })
    await owner.post('/api/resources/trash', { ids: [file.id] })
    expect((await reader.get(`/api/resources/${file.id}`)).status).toBe(403)
  })

  it('respects broken inheritance', async () => {
    const { client: reader, email } = await readerClient(owner)
    const folder = await folderIn(root)
    const isolated = await fileIn(folder)
    await owner.post(`/api/resources/${folder}/access`, { email, notify: false })
    await owner.patch(`/api/resources/${isolated.id}`, { inheritAccess: false })
    expect((await reader.get(`/api/folders/${folder}`)).body.items).toHaveLength(0)
    expect((await reader.get(`/api/resources/${isolated.id}`)).status).toBe(403)
  })
})

describe('public links', () => {
  async function publicLink(resourceId: string, settings: object = {}) {
    const response = await owner.put(`/api/resources/${resourceId}/link`, { enabled: true, ...settings })
    expect(response.status).toBe(200)
    return new URL(response.body.link.url).pathname.split('/').at(-1)!
  }

  it('give anonymous access to a folder and its content only', async () => {
    const folder = await folderIn(root, unique('Camp'))
    const file = await fileIn(folder, 'programme.txt', 'programme')
    const outside = await fileIn(root)
    const token = await publicLink(folder)
    const visitor = new Client()

    const page = await visitor.get(`/api/s/${token}`)
    expect(page.body).toMatchObject({ kind: 'link', root: { id: folder } })
    expect(page.body.items.map((i: { id: string }) => i.id)).toEqual([file.id])
    expect((await visitor.get(`/api/s/${token}/resources/${file.id}/content`)).body).toBe('programme')
    expect((await visitor.get(`/api/s/${token}/resources/${outside.id}/content`)).status).toBe(403)
    expect((await visitor.get(`/api/s/${token}/folders/${root}`)).status).toBe(403)
  })

  it('stop working once removed', async () => {
    const file = await fileIn(root)
    const token = await publicLink(file.id)
    const visitor = new Client()
    expect((await visitor.get(`/api/s/${token}`)).status).toBe(200)
    await owner.put(`/api/resources/${file.id}/link`, { enabled: false })
    expect((await visitor.get(`/api/s/${token}`)).status).toBe(404)
  })

  it('stop working once expired', async () => {
    const file = await fileIn(root)
    const token = await publicLink(file.id, { expiresAt: new Date(Date.now() - 1000).toISOString() })
    expect((await new Client().get(`/api/s/${token}`)).status).toBe(410)
  })

  it('reject guessed or malformed tokens', async () => {
    for (const token of ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '../../etc/passwd', 'x']) {
      expect((await new Client().get(`/api/s/${encodeURIComponent(token)}`)).status).toBe(404)
    }
  })

  it('log one view per visitor and count downloads', async () => {
    const file = await fileIn(root)
    const token = await publicLink(file.id)
    const visitor = new Client()
    await visitor.get(`/api/s/${token}`)
    await visitor.post(`/api/s/${token}/resources/${file.id}/open`)
    await visitor.post(`/api/s/${token}/resources/${file.id}/open`)
    await visitor.get(`/api/s/${token}/resources/${file.id}/download`)
    await new Client().post(`/api/s/${token}/resources/${file.id}/open`)

    const activity = await owner.get(`/api/resources/${file.id}/activity`)
    expect(activity.body.stats).toMatchObject({ views: 2, downloads: 1, visitors: 2 })
    expect(activity.body.events.some((e: { type: string }) => e.type === 'link_created')).toBe(true)
  })
})

describe('invitations', () => {
  it('turn into a reader account on acceptance', async () => {
    const email = `${unique('invitee')}@example.com`
    const file = await fileIn(root)
    const share = await owner.post(`/api/resources/${file.id}/access`, { email, name: 'Marie', notify: false })
    const token = new URL(share.body.inviteUrl).pathname.split('/').at(-1)!

    const info = await new Client().get(`/api/invite/${token}`)
    expect(info.body).toMatchObject({ email, status: 'pending', accountExists: false })

    const accepted = await new Client().post(`/api/invite/${token}/accept`, { name: 'Marie', password: 'marie-password-1' })
    expect(accepted.status).toBe(200)
    expect((await new Client().post(`/api/invite/${token}/accept`, { name: 'Marie', password: 'marie-password-1' })).status).toBe(410)

    const marie = await new Client().signIn(email, 'marie-password-1')
    expect((await marie.get(`/api/resources/${file.id}/content`)).body).toBe('hello')
    const access = await owner.get(`/api/resources/${file.id}/access`)
    expect(access.body.entries.find((e: { email: string }) => e.email === email)).toMatchObject({ kind: 'user', status: 'active' })
  })

  it('grant access through a personal link until revoked', async () => {
    const email = `${unique('guest')}@example.com`
    const file = await fileIn(root)
    const share = await owner.post(`/api/resources/${file.id}/access`, { email, mode: 'link', notify: false })
    const token = new URL(share.body.inviteUrl).pathname.split('/').at(-1)!
    const guest = new Client()

    const page = await guest.get(`/api/s/${token}`)
    expect(page.body.kind).toBe('invitation')
    expect(page.body.items.map((i: { id: string }) => i.id)).toEqual([file.id])
    await guest.post(`/api/s/${token}/resources/${file.id}/open`)
    const events = (await owner.get(`/api/resources/${file.id}/activity`)).body.events
    expect(events.find((e: { type: string }) => e.type === 'view')).toMatchObject({ actorKind: 'invitation' })

    const people = (await owner.get('/api/people')).body.people
    const invitation = people.find((p: { email: string }) => p.email === email)
    await owner.delete(`/api/invitations/${invitation.id}`)
    expect((await guest.get(`/api/s/${token}`)).status).toBe(410)
  })
})

describe('owner views', () => {
  it('lists home, recent, starred, shared, people and activity', async () => {
    for (const path of ['/api/home', '/api/recent', '/api/starred', '/api/shared', '/api/people', '/api/activity', '/api/storage', '/api/trash']) {
      const response = await owner.get(path)
      expect(response.status, path).toBe(200)
    }
  })
})

describe('csrf', () => {
  it('refuses mutations from another origin, including user content', async () => {
    for (const origin of ['https://evil.example', USERCONTENT_URL]) {
      const response = await fetch(`${process.env.TEST_BASE_URL ?? 'http://localhost:3000'}/api/resources/trash`, {
        method: 'POST',
        headers: { 'origin': origin, 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [root] }),
      })
      expect(response.status).toBe(403)
    }
  })
})
