import { eq } from 'drizzle-orm'
import { keepBothName } from '#shared/utils/names'
import { detectMimeType } from '../lib/mime'
import type { Resource } from '../database/schema'

export const SNIFF_BYTES = 4100

export type ConflictStrategy = 'fail' | 'keep' | 'replace'

export interface UploadPlan {
  parent: Resource | null
  fields: ReturnType<typeof nameFields>
  existing: Resource | null
  conflict: ConflictStrategy
  size: number
}

/** Every check that can refuse an upload runs before a single byte is stored. */
export async function planUpload(input: { parentId?: string | null, name: string, conflict: ConflictStrategy, size: number }): Promise<UploadPlan> {
  const { uploadMaxBytes, storageQuotaBytes } = useRuntimeConfig()
  if (!Number.isFinite(input.size) || input.size < 0) throw createError({ statusCode: 411, statusMessage: tr('errors.unknownSize') })
  if (input.size > uploadMaxBytes) throw createError({ statusCode: 413, statusMessage: tr('errors.fileTooLarge') })
  if ((await usedBytes()) + input.size > storageQuotaBytes) throw createError({ statusCode: 507, statusMessage: tr('errors.storageFull') })

  const parent = await requireFolder(input.parentId)
  const parentId = parent?.id ?? null
  let fields = nameFields(input.name)
  const existing = await findSibling(parentId, fields.nameLower)
  if (existing && input.conflict === 'fail') {
    throw createError({ statusCode: 409, statusMessage: tr('errors.nameTakenShort', { name: existing.name }), data: { reason: 'name_taken', existingId: existing.id } })
  }
  if (existing && input.conflict === 'replace' && existing.type === 'folder') {
    throw createError({ statusCode: 409, statusMessage: tr('errors.folderNotReplaceable') })
  }
  if (existing && input.conflict === 'keep') fields = nameFields(keepBothName(fields.name, await siblingNames(parentId)))
  return { parent, fields, existing, conflict: input.conflict, size: input.size }
}

/** Turns a stored blob into a resource: a new file, or a new version of the one it replaces (id and shares kept). */
export async function commitUpload(viewer: Viewer, plan: UploadPlan, blob: { storageKey: string, size: number, checksum: string, head: Uint8Array }) {
  const { resources } = tables
  const db = useDB()
  const storage = useStorageProvider()
  const mimeType = await detectMimeType(blob.head.subarray(0, SNIFF_BYTES), plan.fields.extension)
  const replacing = plan.existing && plan.conflict === 'replace' ? plan.existing : null
  const content = {
    storageKey: blob.storageKey,
    size: blob.size,
    checksum: blob.checksum,
    mimeType,
    thumbnailKey: null,
    thumbnailStatus: canThumbnail(mimeType, blob.size) ? 'pending' as const : 'none' as const,
    previewKey: null,
    width: null,
    height: null,
    updatedAt: new Date(),
  }

  let resource: Resource
  try {
    if (replacing) {
      [resource] = await db.update(resources).set({ extension: plan.fields.extension, ...content }).where(eq(resources.id, replacing.id)).returning() as [Resource]
      for (const key of [replacing.storageKey, replacing.thumbnailKey, replacing.previewKey]) if (key) await storage.delete(key).catch(() => {})
    }
    else {
      [resource] = await db.insert(resources).values({
        ...plan.fields,
        ...content,
        type: 'file',
        parentId: plan.parent?.id ?? null,
        ancestorIds: childAncestors(plan.parent),
        createdAt: content.updatedAt,
      }).returning() as [Resource]
    }
  }
  catch (error) {
    await storage.delete(blob.storageKey).catch(() => {})
    if (isUniqueViolation(error)) nameTaken(plan.fields.name)
    throw error
  }

  enqueueProcessing(resource.id)
  const summaries = await summarizeMany([resource])
  return { item: toItem(resource, { viewer, summary: summaries.get(resource.id) }), replaced: !!replacing }
}
