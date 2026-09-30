/** Operations on the tree, shared by the API and the MCP tools: each one checks what the viewer may do. */
import type { H3Event } from 'h3'
import { buffer } from 'node:stream/consumers'
import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { keepBothName } from '#shared/utils/names'
import type { Resource } from '../database/schema'

export async function createFolder(viewer: Viewer, parentId: string | null | undefined, name: string) {
  const parent = await requireFolder(viewer, parentId)
  const fields = nameFields(name)
  if (await findSibling(parent?.id ?? null, fields.nameLower)) nameTaken(fields.name)

  try {
    const [folder] = await useDB().insert(tables.resources).values({
      ...fields,
      extension: null,
      type: 'folder',
      parentId: parent?.id ?? null,
      ancestorIds: childAncestors(parent),
    }).returning()
    const summaries = await summarizeMany([folder!])
    return toItem(folder!, { viewer, summary: summaries.get(folder!.id) })
  }
  catch (error) {
    if (isUniqueViolation(error)) nameTaken(fields.name)
    throw error
  }
}

export interface ResourceChanges {
  name?: string
  inheritAccess?: boolean
  allowScripts?: boolean
  versioning?: boolean
}

/** Renaming is editing; sharing inheritance, scripts and version history are decided by those who manage the item. */
export async function updateResource(event: H3Event, viewer: Viewer, id: string, changes: ResourceChanges) {
  const settings = changes.inheritAccess !== undefined || changes.allowScripts !== undefined || changes.versioning !== undefined
  const { resource } = await requireAccess(viewer, id, settings ? 'manage' : 'edit')
  const { resources } = tables
  const patch: Partial<typeof resources.$inferInsert> = {}

  if (changes.name !== undefined && changes.name !== resource.name) {
    const fields = nameFields(changes.name)
    const sibling = await findSibling(resource.parentId, fields.nameLower)
    if (sibling && sibling.id !== resource.id) nameTaken(fields.name)
    Object.assign(patch, resource.type === 'folder' ? { ...fields, extension: null } : fields, { updatedAt: new Date() })
  }
  if (changes.inheritAccess !== undefined) patch.inheritAccess = changes.inheritAccess
  if (changes.versioning !== undefined) {
    if (resource.type !== 'folder') throw createError({ statusCode: 400, statusMessage: tr('errors.foldersOnly') })
    patch.versioning = await setVersioning(resource, changes.versioning)
  }
  if (changes.allowScripts !== undefined) {
    if (resourceKind(resource) !== 'html') throw createError({ statusCode: 400, statusMessage: tr('errors.htmlOnly') })
    patch.allowScripts = changes.allowScripts
  }

  let updated = resource
  if (Object.keys(patch).length > 0) {
    try {
      [updated] = await useDB().update(resources).set(patch).where(eq(resources.id, resource.id)).returning() as [typeof resource]
    }
    catch (error) {
      if (isUniqueViolation(error)) nameTaken(changes.name!)
      throw error
    }
  }

  if (changes.inheritAccess !== undefined && changes.inheritAccess !== resource.inheritAccess) {
    await logOwnerAction(event, viewer, resource.id, 'share_updated', changes.inheritAccess ? ACTIVITY_LABELS.inheritRestored : ACTIVITY_LABELS.inheritRemoved)
  }
  const summaries = await summarizeMany([updated])
  return toItem(updated, { viewer, summary: summaries.get(updated.id) })
}

export async function moveResources(viewer: Viewer, ids: string[], targetId: string | null, conflict: 'fail' | 'keep') {
  const target = await requireFolder(viewer, targetId)
  const destination = target?.id ?? null
  const items = (await requireAll(viewer, ids, 'edit')).filter(item => item.parentId !== destination)
  if (items.some(item => target && (item.id === target.id || target.ancestorIds.includes(item.id)))) {
    throw createError({ statusCode: 400, statusMessage: tr('errors.moveIntoItself') })
  }

  const taken = await siblingNames(destination)
  const takenLower = new Set(taken.map(n => n.toLowerCase()))
  const conflicts = items.filter(item => takenLower.has(item.nameLower)).map(item => item.name)
  if (conflicts.length > 0 && conflict === 'fail') {
    throw createError({ statusCode: 409, statusMessage: tr('errors.someNamesTaken'), data: { reason: 'name_taken', conflicts } })
  }

  await useDB().transaction(async (tx) => {
    for (const item of items) {
      const name = keepBothName(item.name, taken)
      taken.push(name)
      await reparent(tx, item, target, name === item.name ? {} : nameFields(name))
    }
  })
  return { moved: items.map(item => item.id), target: target ? { id: target.id, name: target.name } : { id: null, name: rootCrumb().name } }
}

/** Recoverable: the items wait in the trash until someone who manages them deletes them. */
export async function trashResources(viewer: Viewer, ids: string[]) {
  await requireAll(viewer, ids, 'edit')
  const { resources } = tables
  const trashed = await useDB().update(resources).set({ deletedAt: new Date() })
    .where(and(inArray(resources.id, ids), isNull(resources.deletedAt)))
    .returning({ id: resources.id, name: resources.name })
  return { trashed }
}

/** Restores in place; when the original folder is itself in the trash, the item comes back at the top of My Drive. */
export async function restoreResources(viewer: Viewer, ids: string[]) {
  const { resources } = tables
  const db = useDB()
  const items = (await requireAll(viewer, ids, 'edit', { trashed: true })).filter(item => item.deletedAt)

  const restored = []
  for (const item of items) {
    const chain = await loadChain(item)
    const movedToRoot = chain.slice(1).some(node => node.deletedAt)
    if (movedToRoot && !viewer.ctx.isOwner) throw createError({ statusCode: 409, statusMessage: tr('errors.restoreFolderFirst') })
    const parentId = movedToRoot ? null : item.parentId
    const name = keepBothName(item.name, await siblingNames(parentId))
    const renamed = name !== item.name
    await db.transaction(async (tx) => {
      const patch = { deletedAt: null, ...(renamed ? nameFields(name) : {}) }
      if (movedToRoot) await reparent(tx, item, null, patch)
      else await tx.update(resources).set(patch).where(eq(resources.id, item.id))
    })
    restored.push({ id: item.id, name, parentId, renamed, movedToRoot })
  }
  return { restored }
}

export async function listTrash(viewer: Viewer, limit = 2000) {
  const { resources } = tables
  const trashed = await useDB().select().from(resources).where(isNotNull(resources.deletedAt)).orderBy(desc(resources.deletedAt)).limit(limit)
  const items = viewer.ctx.isOwner ? trashed : await editableOf(viewer, trashed)
  const locations = await locationsOf(items)
  return items.map(item => toItem(item, { viewer, location: locations.get(item.id) }))
}

/** Copies files, not folders, into a folder or next to themselves; a copy gets a free name and no shares of its own. */
export async function copyFiles(viewer: Viewer, ids: string[], targetId?: string | null) {
  const storage = useStorageProvider()
  const copies = []
  for (const id of ids) {
    const { resource: file, access } = await requireAccess(viewer, id)
    if (!access.download) throw createError({ statusCode: 403, statusMessage: tr('errors.downloadDisabled') })
    if (file.type !== 'file' || !file.storageKey || !file.checksum) throw createError({ statusCode: 400, statusMessage: tr('errors.filesOnly') })
    const plan = await planUpload(viewer, { parentId: targetId === undefined ? file.parentId : targetId, name: file.name, conflict: 'keep', size: file.size })
    const storageKey = newBlobKey()
    await storage.put(storageKey, await storage.get(file.storageKey), file.mimeType ?? undefined)
    const head = file.size ? await buffer(await storage.get(storageKey, { start: 0, end: Math.min(file.size, SNIFF_BYTES) - 1 })) : Buffer.alloc(0)
    const { item } = await commitUpload(viewer, plan, { storageKey, size: file.size, checksum: file.checksum, head })
    copies.push(item)
  }
  return copies
}

async function editableOf(viewer: Viewer, items: Resource[]) {
  const editable = []
  for (const item of items) {
    if ((await accessOf(viewer, item, { trashed: true })).access.edit) editable.push(item)
  }
  return editable
}
