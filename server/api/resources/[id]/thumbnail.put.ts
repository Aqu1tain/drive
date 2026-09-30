import { Readable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { kindOf } from '#shared/utils/search'

const MAX_FRAME_BYTES = 5 * 1024 * 1024

/** Video frames are captured by the browser of someone who can edit the video (no decoder on the server), then re-encoded here like any image. */
export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const { resource } = await requireAccess(viewer, getRouterParam(event, 'id')!, 'edit')
  if (!resource.checksum || kindOf(resource.type, resource.mimeType) !== 'video') throw createError({ statusCode: 404, statusMessage: tr('errors.videoNotFound') })
  if (Number(getHeader(event, 'content-length') ?? 0) > MAX_FRAME_BYTES) throw createError({ statusCode: 413, statusMessage: tr('errors.imageTooLarge') })

  const frame = await readRawBody(event, false)
  if (!frame?.length || frame.length > MAX_FRAME_BYTES) throw createError({ statusCode: 400, statusMessage: tr('errors.imageMissing') })
  const thumbnail = await imageThumbnail(frame).catch(() => {
    throw createError({ statusCode: 400, statusMessage: tr('errors.imageUnreadable') })
  })

  const { resources } = tables
  const key = thumbnailKeyOf(resource.id, resource.checksum)
  await useStorageProvider().put(key, Readable.from(thumbnail.data), 'image/webp')
  const [updated] = await useDB().update(resources)
    .set({ thumbnailKey: key, thumbnailStatus: 'ready' })
    .where(eq(resources.id, resource.id))
    .returning()
  if (resource.thumbnailKey && resource.thumbnailKey !== key) await deleteBlobs([resource.thumbnailKey])
  return { thumbnailUrl: thumbnailPath(updated!, viewer.apiBase) }
})
