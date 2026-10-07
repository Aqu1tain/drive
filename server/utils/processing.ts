import { Readable } from 'node:stream'
import { buffer } from 'node:stream/consumers'
import { and, eq, sql } from 'drizzle-orm'
import sharp from 'sharp'
import { searchWordsOf } from '#shared/utils/names'
import { EPUB, deriveDocument, readsContent, type Derived } from '../lib/documents'
import type { Resource } from '../database/schema'

/** SVG is deliberately absent: its loader can reach external resources, so it is blocked entirely. */
const IMAGE = /^image\/(png|jpeg|gif|webp|avif|tiff)$/
sharp.block({ operation: ['VipsForeignLoadSvg'] })
const CONCURRENCY = 2
const MAX_INPUT_BYTES = 80 * 1024 * 1024
const MAX_INDEXED_CHARS = 100_000

type StoredFile = Resource & { storageKey: string, checksum: string }

interface Outcome {
  patch: Partial<Pick<Resource, 'thumbnailKey' | 'thumbnailStatus' | 'width' | 'height' | 'previewKey'>>
  text?: string
  site?: SiteFile[] | null
  written: string[]
}

const queue = new Set<string>()
let running = 0

export const canThumbnail = (mimeType: string | null, size: number) =>
  !!mimeType && (IMAGE.test(mimeType) || mimeType === 'application/pdf' || mimeType === EPUB) && size <= MAX_INPUT_BYTES

/** Thumbnails, search text and document previews are derived in the background, once per file version. */
export function enqueueProcessing(resourceId: string) {
  queue.add(resourceId)
  pump()
}

function pump() {
  while (running < CONCURRENCY && queue.size > 0) {
    const id = queue.values().next().value!
    queue.delete(id)
    running++
    processResource(id)
      .catch(error => logFailure(id, error))
      .finally(() => {
        running--
        pump()
      })
  }
}

const logFailure = (resourceId: string, error: unknown) =>
  console.error(JSON.stringify({ level: 'error', job: 'processing', resourceId, error: String(error) }))

async function processResource(resourceId: string) {
  const resource = await findResource(resourceId)
  if (!resource?.storageKey || !resource.checksum || resource.processedChecksum === resource.checksum) return
  const file = resource as StoredFile

  const outcome = await derive(file).catch((error): Outcome => {
    logFailure(resourceId, error)
    return { patch: file.thumbnailStatus === 'pending' ? { thumbnailStatus: 'failed' } : {}, written: [] }
  })

  const { resources } = tables
  const [saved] = await useDB().update(resources)
    .set({ ...outcome.patch, siteChecksum: outcome.site ? file.checksum : null, processedChecksum: file.checksum })
    .where(and(eq(resources.id, file.id), eq(resources.checksum, file.checksum)))
    .returning({ id: resources.id })
  if (!saved) return deleteBlobs(outcome.written)

  await saveText(file.id, outcome.text)
  await replaceSiteFiles(file.id, outcome.site ?? [])
  await deleteBlobs((['thumbnailKey', 'previewKey'] as const).flatMap((field) => {
    const previous = file[field]
    const next = outcome.patch[field]
    return previous && next && previous !== next ? [previous] : []
  }))
}

async function derive(file: StoredFile): Promise<Outcome> {
  const thumbnailKey = thumbnailKeyOf(file.id, file.checksum)
  const wantsThumbnail = canThumbnail(file.mimeType, file.size) && !(file.thumbnailStatus === 'ready' && file.thumbnailKey === thumbnailKey)
  const wantsContent = readsContent(file.mimeType) && file.size <= MAX_INPUT_BYTES
  const wantsSite = file.mimeType === 'application/zip' && file.size <= MAX_INPUT_BYTES
  if (!wantsThumbnail && !wantsContent && !wantsSite) return { patch: {}, written: [] }

  const storage = useStorageProvider()
  const data = await buffer(await storage.get(file.storageKey))
  const document: Derived = wantsContent ? await deriveDocument(file.mimeType!, file.name, data, instanceLocale()) : {}
  const image = wantsThumbnail && IMAGE.test(file.mimeType!) ? await imageThumbnail(data) : undefined
  const site = wantsSite ? await extractSite(file, data) : null
  const outcome: Outcome = { patch: {}, text: document.text, site, written: site?.map(entry => entry.storageKey) ?? [] }

  const thumbnail = image?.data ?? document.thumbnail
  if (wantsThumbnail && thumbnail) {
    await storage.put(thumbnailKey, Readable.from(thumbnail), 'image/webp')
    outcome.written.push(thumbnailKey)
    outcome.patch = { thumbnailKey, thumbnailStatus: 'ready', width: image?.width ?? null, height: image?.height ?? null }
  }
  else if (wantsThumbnail) outcome.patch.thumbnailStatus = 'failed'

  if (document.html) {
    const previewKey = previewKeyOf(file.id, file.checksum)
    await storage.put(previewKey, Readable.from(Buffer.from(document.html)), 'text/html; charset=utf-8')
    outcome.written.push(previewKey)
    outcome.patch.previewKey = previewKey
  }
  return outcome
}

export async function imageThumbnail(input: Buffer) {
  const image = sharp(input, { limitInputPixels: 120_000_000, failOn: 'error', autoOrient: true })
  const metadata = await image.metadata()
  const data = await image
    .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()
  const rotated = (metadata.orientation ?? 1) >= 5
  return { data, width: rotated ? metadata.height : metadata.width, height: rotated ? metadata.width : metadata.height }
}

async function saveText(resourceId: string, text: string | undefined) {
  const { resourceTexts } = tables
  const db = useDB()
  const words = searchWordsOf(text ?? '').join(' ').slice(0, MAX_INDEXED_CHARS)
  if (!words) return db.delete(resourceTexts).where(eq(resourceTexts.resourceId, resourceId))
  await db.insert(resourceTexts)
    .values({ resourceId, words: sql`to_tsvector('simple', ${words})` })
    .onConflictDoUpdate({ target: resourceTexts.resourceId, set: { words: sql`excluded.words` } })
}
