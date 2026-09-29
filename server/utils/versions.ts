import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { versionsToPrune } from '#shared/utils/versions'
import type { FileVersionItem, VersionHistory, VersioningState } from '#shared/types/api'
import type { FileVersion, Resource } from '../database/schema'

/** A folder decides for itself, otherwise the closest folder above that decided; nothing decided means off. */
export async function versioningOf(resource: Pick<Resource, 'id' | 'type' | 'ancestorIds'>): Promise<VersioningState> {
  const { resources } = tables
  const chain = resource.type === 'folder' ? [...resource.ancestorIds, resource.id] : resource.ancestorIds
  if (chain.length === 0) return { enabled: false, source: null }
  const decided = await useDB().select({ id: resources.id, name: resources.name, versioning: resources.versioning }).from(resources)
    .where(and(inArray(resources.id, chain), isNotNull(resources.versioning)))
  const closest = chain.toReversed().map(id => decided.find(row => row.id === id)).find(row => row !== undefined)
  return closest ? { enabled: closest.versioning!, source: { id: closest.id, name: closest.name } } : { enabled: false, source: null }
}

/** Stores the folder's own choice, or none when it matches what it would inherit anyway. */
export async function setVersioning(folder: Resource, enabled: boolean) {
  const inherited = folder.parentId ? await versioningOf({ id: folder.parentId, type: 'folder', ancestorIds: folder.ancestorIds.slice(0, -1) }) : { enabled: false }
  return inherited.enabled === enabled ? null : enabled
}

/** The content a file had until now, as a version row. */
export const versionOf = (file: Resource) => ({
  resourceId: file.id,
  storageKey: file.storageKey!,
  size: file.size,
  checksum: file.checksum!,
  mimeType: file.mimeType,
  savedAt: file.updatedAt,
})

export async function pruneVersions(resourceId: string) {
  const { fileVersions } = tables
  const db = useDB()
  const versions = await db.select({ id: fileVersions.id, savedAt: fileVersions.savedAt, label: fileVersions.label }).from(fileVersions)
    .where(eq(fileVersions.resourceId, resourceId))
  const ids = versionsToPrune(versions)
  if (ids.length === 0) return
  const removed = await db.delete(fileVersions).where(inArray(fileVersions.id, ids)).returning({ storageKey: fileVersions.storageKey })
  await deleteBlobs(removed.map(row => row.storageKey))
}

const toVersionItem = (version: FileVersion, base: string): FileVersionItem => ({
  id: version.id,
  size: version.size,
  mimeType: version.mimeType,
  label: version.label,
  savedAt: version.savedAt.toISOString(),
  replacedAt: version.replacedAt.toISOString(),
  contentUrl: `${base}/resources/${version.resourceId}/versions/${version.id}/content`,
  downloadUrl: `${base}/resources/${version.resourceId}/versions/${version.id}/download`,
})

export async function versionHistory(viewer: Viewer, file: Resource): Promise<VersionHistory> {
  const { fileVersions } = tables
  const [versions, versioning] = await Promise.all([
    useDB().select().from(fileVersions).where(eq(fileVersions.resourceId, file.id)).orderBy(desc(fileVersions.savedAt)),
    versioningOf(file),
  ])
  return {
    versioning,
    current: { size: file.size, mimeType: file.mimeType, savedAt: file.updatedAt.toISOString() },
    versions: versions.map(version => toVersionItem(version, viewer.apiBase)),
    totalSize: versions.reduce((total, version) => total + version.size, 0),
  }
}

export async function requireVersion(file: Resource, versionId: string) {
  const { fileVersions } = tables
  const [version] = isUuid(versionId)
    ? await useDB().select().from(fileVersions).where(and(eq(fileVersions.id, versionId), eq(fileVersions.resourceId, file.id))).limit(1)
    : []
  if (!version) throw createError({ statusCode: 404, statusMessage: tr('errors.versionNotFound') })
  return version
}

/** The file seen through one of its versions, to serve that content with the usual headers and checks. */
export const asVersion = (file: Resource, version: FileVersion): Resource =>
  ({ ...file, storageKey: version.storageKey, size: version.size, checksum: version.checksum, mimeType: version.mimeType })

/** Nothing is lost: the current content joins the history before the chosen version takes its place. */
export async function restoreVersion(file: Resource, version: FileVersion) {
  const { resources, fileVersions } = tables
  const restored = await useDB().transaction(async (tx) => {
    await tx.insert(fileVersions).values(versionOf(file))
    await tx.delete(fileVersions).where(eq(fileVersions.id, version.id))
    const [updated] = await tx.update(resources).set({
      storageKey: version.storageKey,
      size: version.size,
      checksum: version.checksum,
      mimeType: version.mimeType,
      thumbnailKey: null,
      thumbnailStatus: canThumbnail(version.mimeType, version.size) ? 'pending' : 'none',
      previewKey: null,
      width: null,
      height: null,
      updatedAt: new Date(),
    }).where(eq(resources.id, file.id)).returning()
    return updated!
  })
  await deleteBlobs([file.thumbnailKey, file.previewKey].filter((key): key is string => !!key))
  enqueueProcessing(file.id)
  await pruneVersions(file.id)
  return restored
}

export async function deleteVersion(version: FileVersion) {
  const { fileVersions } = tables
  await useDB().delete(fileVersions).where(eq(fileVersions.id, version.id))
  await deleteBlobs([version.storageKey])
}

export async function labelVersion(version: FileVersion, label: string | null) {
  const { fileVersions } = tables
  const [updated] = await useDB().update(fileVersions).set({ label }).where(eq(fileVersions.id, version.id)).returning()
  return updated!
}

/** Daily: applies the cleanup rule to every file that has versions. */
export async function pruneAllVersions() {
  const { fileVersions } = tables
  const files = await useDB().selectDistinct({ id: fileVersions.resourceId }).from(fileVersions).orderBy(asc(fileVersions.resourceId))
  for (const { id } of files) await pruneVersions(id)
  return files.length
}

export async function versionBytes() {
  const { fileVersions } = tables
  const [row] = await useDB().select({ total: sql<string>`coalesce(sum(${fileVersions.size}), 0)` }).from(fileVersions)
  return Number(row?.total ?? 0)
}
