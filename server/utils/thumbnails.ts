import { Readable } from 'node:stream'
import { buffer } from 'node:stream/consumers'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'

/** SVG is deliberately absent: its loader can reach external resources, so it is blocked entirely. */
const THUMBNAILABLE = /^image\/(png|jpeg|gif|webp|avif|tiff)$/
sharp.block({ operation: ['VipsForeignLoadSvg'] })
const CONCURRENCY = 2
const MAX_INPUT_BYTES = 80 * 1024 * 1024

const queue: string[] = []
let running = 0

export const canThumbnail = (mimeType: string | null, size: number) =>
  !!mimeType && THUMBNAILABLE.test(mimeType) && size <= MAX_INPUT_BYTES

export function enqueueThumbnail(resourceId: string) {
  if (!queue.includes(resourceId)) queue.push(resourceId)
  pump()
}

function pump() {
  while (running < CONCURRENCY && queue.length > 0) {
    const id = queue.shift()!
    running++
    generate(id)
      .catch(error => console.error(JSON.stringify({ level: 'error', job: 'thumbnail', resourceId: id, error: String(error) })))
      .finally(() => {
        running--
        pump()
      })
  }
}

async function generate(resourceId: string) {
  const { resources } = tables
  const db = useDB()
  const resource = await findResource(resourceId)
  if (!resource?.storageKey || !resource.checksum || !canThumbnail(resource.mimeType, resource.size)) return

  const storage = useStorageProvider()
  try {
    const input = await buffer(await storage.get(resource.storageKey))
    const image = sharp(input, { limitInputPixels: 120_000_000, failOn: 'error', autoOrient: true })
    const metadata = await image.metadata()
    const output = await image
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    const key = thumbnailKeyOf(resource.id, resource.checksum)
    await storage.put(key, Readable.from(output), 'image/webp')
    const rotated = (metadata.orientation ?? 1) >= 5
    await db.update(resources).set({
      thumbnailKey: key,
      thumbnailStatus: 'ready',
      width: rotated ? metadata.height : metadata.width,
      height: rotated ? metadata.width : metadata.height,
    }).where(eq(resources.id, resource.id))
    if (resource.thumbnailKey && resource.thumbnailKey !== key) await storage.delete(resource.thumbnailKey)
  }
  catch (error) {
    await db.update(resources).set({ thumbnailStatus: 'failed' }).where(eq(resources.id, resource.id))
    throw error
  }
}
