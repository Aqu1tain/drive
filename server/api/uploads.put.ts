import { createHash } from 'node:crypto'
import { Transform } from 'node:stream'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { keepBothName } from '#shared/utils/names'
import { detectMimeType } from '../lib/mime'

const SNIFF_BYTES = 4100

const querySchema = z.object({
  parentId: z.string().optional(),
  name: z.string().min(1),
  conflict: z.enum(['fail', 'keep', 'replace']).default('fail'),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const query = await getValidatedQuery(event, querySchema.parse)
  const { uploadMaxBytes, storageQuotaBytes } = useRuntimeConfig()
  const { resources } = tables
  const db = useDB()

  const declared = Number(getRequestHeader(event, 'content-length'))
  if (!Number.isFinite(declared) || declared < 0) throw createError({ statusCode: 411, statusMessage: 'Taille du fichier inconnue' })
  if (declared > uploadMaxBytes) throw createError({ statusCode: 413, statusMessage: 'Fichier trop volumineux' })
  if ((await usedBytes()) + declared > storageQuotaBytes) throw createError({ statusCode: 507, statusMessage: 'Espace de stockage insuffisant' })

  const parent = await requireFolder(query.parentId)
  const parentId = parent?.id ?? null
  let fields = nameFields(query.name)

  const existing = await findSibling(parentId, fields.nameLower)
  if (existing && query.conflict === 'fail') {
    throw createError({ statusCode: 409, statusMessage: `« ${existing.name} » existe déjà`, data: { reason: 'name_taken', existingId: existing.id } })
  }
  if (existing && query.conflict === 'replace' && existing.type === 'folder') {
    throw createError({ statusCode: 409, statusMessage: 'Un dossier ne peut pas être remplacé par un fichier' })
  }
  if (existing && query.conflict === 'keep') fields = nameFields(keepBothName(fields.name, await siblingNames(parentId)))

  const hash = createHash('sha256')
  const head: Buffer[] = []
  let headBytes = 0
  let received = 0
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length
      if (received > declared) return callback(createError({ statusCode: 400, statusMessage: 'Taille reçue incohérente' }))
      hash.update(chunk)
      if (headBytes < SNIFF_BYTES) {
        head.push(chunk)
        headBytes += chunk.length
      }
      callback(null, chunk)
    },
  })
  const source = event.node.req
  source.on('error', error => meter.destroy(error))
  source.on('aborted', () => meter.destroy(new Error('Upload aborted')))
  source.pipe(meter)

  const storage = useStorageProvider()
  const storageKey = newBlobKey()
  try {
    await storage.put(storageKey, meter)
    if (received !== declared) throw createError({ statusCode: 400, statusMessage: 'Import incomplet' })
  }
  catch (error) {
    await storage.delete(storageKey).catch(() => {})
    throw error
  }

  const mimeType = await detectMimeType(Buffer.concat(head).subarray(0, SNIFF_BYTES), fields.extension)
  const checksum = hash.digest('hex')
  const now = new Date()
  const content = {
    storageKey,
    size: received,
    checksum,
    mimeType,
    thumbnailKey: null,
    thumbnailStatus: canThumbnail(mimeType, received) ? 'pending' as const : 'none' as const,
    width: null,
    height: null,
    updatedAt: now,
  }

  let resource
  try {
    if (existing && query.conflict === 'replace') {
      [resource] = await db.update(resources).set({ ...fields, name: existing.name, nameLower: existing.nameLower, searchKey: existing.searchKey, ...content })
        .where(eq(resources.id, existing.id)).returning()
      if (existing.storageKey) await storage.delete(existing.storageKey).catch(() => {})
      if (existing.thumbnailKey) await storage.delete(existing.thumbnailKey).catch(() => {})
    }
    else {
      [resource] = await db.insert(resources).values({
        ...fields,
        ...content,
        type: 'file',
        parentId,
        ancestorIds: childAncestors(parent),
        createdAt: now,
      }).returning()
    }
  }
  catch (error) {
    await storage.delete(storageKey).catch(() => {})
    if (isUniqueViolation(error)) nameTaken(fields.name)
    throw error
  }

  if (resource!.thumbnailStatus === 'pending') enqueueThumbnail(resource!.id)
  const summaries = await summarizeMany([resource!])
  setResponseStatus(event, existing && query.conflict === 'replace' ? 200 : 201)
  return toItem(resource!, { viewer, summary: summaries.get(resource!.id) })
})
