/** Owner operations on the tree, shared by the API and the MCP tools. Callers check that the viewer is the owner. */
import type { H3Event } from 'h3'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { keepBothName } from '#shared/utils/names'

export async function createFolder(viewer: Viewer, parentId: string | null | undefined, name: string) {
  const parent = await requireFolder(parentId)
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
  starred?: boolean
  inheritAccess?: boolean
  allowScripts?: boolean
  versioning?: boolean
}

export async function updateResource(event: H3Event, viewer: Viewer, id: string, changes: ResourceChanges) {
  const resource = await requireOwned(id)
  const { resources } = tables
  const patch: Partial<typeof resources.$inferInsert> = {}

  if (changes.name !== undefined && changes.name !== resource.name) {
    const fields = nameFields(changes.name)
    const sibling = await findSibling(resource.parentId, fields.nameLower)
    if (sibling && sibling.id !== resource.id) nameTaken(fields.name)
    Object.assign(patch, resource.type === 'folder' ? { ...fields, extension: null } : fields, { updatedAt: new Date() })
  }
  if (changes.starred !== undefined) patch.starred = changes.starred
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

export async function moveResources(ids: string[], targetId: string | null, conflict: 'fail' | 'keep') {
  const target = await requireFolder(targetId)
  const destination = target?.id ?? null
  const { resources } = tables

  const items = (await useDB().select().from(resources).where(inArray(resources.id, ids)))
    .filter(item => item.parentId !== destination)
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

/** Recoverable: the items wait in the trash until the owner empties it. */
export async function trashResources(ids: string[]) {
  const { resources } = tables
  const trashed = await useDB().update(resources).set({ deletedAt: new Date() })
    .where(and(inArray(resources.id, ids), isNull(resources.deletedAt)))
    .returning({ id: resources.id, name: resources.name })
  return { trashed }
}
