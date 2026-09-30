import { and, eq, isNull, sql } from 'drizzle-orm'
import { extensionOf, sanitizeName, searchKeyOf, InvalidNameError, MAX_NAME_LENGTH } from '#shared/utils/names'
import type { Resource } from '../database/schema'
import type { Transaction } from './db'

const { resources } = tables

export function nameFields(raw: string) {
  try {
    const name = sanitizeName(raw)
    return { name, nameLower: name.toLowerCase(), searchKey: searchKeyOf(name), extension: extensionOf(name) }
  }
  catch (error) {
    if (error instanceof InvalidNameError) throw createError({ statusCode: 400, statusMessage: tr(error.key, { max: MAX_NAME_LENGTH }) })
    throw error
  }
}

export const childAncestors = (parent: Resource | null) => parent ? [...parent.ancestorIds, parent.id] : []

/** Where items go: a live folder the viewer can edit, or the top of the drive (null), which only owners organize. */
export async function requireFolder(viewer: Viewer, parentId: string | null | undefined) {
  if (!parentId || parentId === 'root') {
    if (!viewer.ctx.isOwner) throw createError({ statusCode: 403, statusMessage: tr('errors.topLevelOwnerOnly') })
    return null
  }
  const folder = await findResource(parentId)
  if (!folder || folder.type !== 'folder') throw createError({ statusCode: 404, statusMessage: tr('errors.folderNotFound') })
  const chain = await loadChain(folder)
  if (chain.some(node => node.deletedAt)) throw createError({ statusCode: 409, statusMessage: tr('errors.folderInTrash') })
  await requireAccess(viewer, folder.id, 'edit')
  return folder
}

export async function findSibling(parentId: string | null, nameLower: string) {
  const [row] = await useDB().select().from(resources).where(and(
    parentId ? eq(resources.parentId, parentId) : isNull(resources.parentId),
    eq(resources.nameLower, nameLower),
    isNull(resources.deletedAt),
  )).limit(1)
  return row ?? null
}

export async function siblingNames(parentId: string | null) {
  const rows = await useDB().select({ name: resources.name }).from(resources).where(and(
    parentId ? eq(resources.parentId, parentId) : isNull(resources.parentId),
    isNull(resources.deletedAt),
  ))
  return rows.map(r => r.name)
}

/** Files and their kept versions both take room. */
export async function usedBytes() {
  const [row] = await useDB().select({ total: sql<string>`coalesce(sum(${resources.size}), 0)` }).from(resources).where(eq(resources.type, 'file'))
  return Number(row?.total ?? 0) + await versionBytes()
}

export function isUniqueViolation(error: unknown) {
  const code = (error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code
  return code === '23505'
}

export function nameTaken(name: string): never {
  throw createError({ statusCode: 409, statusMessage: tr('errors.nameTaken', { name }), data: { reason: 'name_taken' } })
}

export const uuidArray = (ids: string[]) =>
  ids.length ? sql`array[${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)}]` : sql`'{}'::uuid[]`

/** Moves a resource under `target` (null = root) and rewrites the ancestor path of its whole subtree. */
export async function reparent(tx: Transaction, resource: Resource, target: Resource | null, patch: Partial<typeof resources.$inferInsert> = {}) {
  const ancestorIds = childAncestors(target)
  await tx.update(resources).set({ ...patch, parentId: target?.id ?? null, ancestorIds }).where(eq(resources.id, resource.id))
  if (resource.type !== 'folder') return
  await tx.execute(sql`
    update ${resources}
    set ancestor_ids = ${uuidArray(ancestorIds)} || ancestor_ids[${sql.raw(String(resource.ancestorIds.length + 1))}:]
    where ancestor_ids @> array[${resource.id}::uuid]
  `)
}

/** Storage keys of a resource and everything below it, to delete blobs once rows are gone. */
export async function subtreeKeys(ids: string[]) {
  if (ids.length === 0) return []
  const { siteFiles, fileVersions } = tables
  const subtree = sql`${resources.id} = any(${uuidArray(ids)}) or ${resources.ancestorIds} && ${uuidArray(ids)}`
  const inSubtree = sql`in (select id from ${resources} where ${subtree})`
  const [rows, sites, versions] = await Promise.all([
    useDB().select({ storageKey: resources.storageKey, thumbnailKey: resources.thumbnailKey, previewKey: resources.previewKey }).from(resources).where(subtree),
    useDB().select({ storageKey: siteFiles.storageKey }).from(siteFiles).where(sql`${siteFiles.resourceId} ${inSubtree}`),
    useDB().select({ storageKey: fileVersions.storageKey }).from(fileVersions).where(sql`${fileVersions.resourceId} ${inSubtree}`),
  ])
  return [...rows.flatMap(row => [row.storageKey, row.thumbnailKey, row.previewKey]), ...[...sites, ...versions].map(row => row.storageKey)].filter((key): key is string => !!key)
}

export async function deleteBlobs(keys: string[]) {
  const storage = useStorageProvider()
  await Promise.all(keys.map(key => storage.delete(key).catch(error =>
    console.error(JSON.stringify({ level: 'error', job: 'delete-blob', key, error: String(error) })))))
}

/** "Mon Drive / Clients / Dupont" for each resource, in one query. */
export async function locationsOf(items: Resource[]) {
  const ids = [...new Set(items.flatMap(item => item.ancestorIds))]
  const ancestors = ids.length ? await useDB().select({ id: resources.id, name: resources.name }).from(resources).where(sql`${resources.id} = any(${uuidArray(ids)})`) : []
  const names = new Map(ancestors.map(a => [a.id, a.name]))
  return new Map(items.map(item => [item.id, [tr('common.myDrive'), ...item.ancestorIds.map(id => names.get(id) ?? '…')].join(' / ')]))
}
