import { and, asc, eq, inArray } from 'drizzle-orm'
import type { ResourceItem } from '#shared/types/api'

/** Marks the items a reader starred; the owner's items already carry their star. */
export async function withFavorites(viewer: Viewer, items: ResourceItem[]) {
  if (viewer.ctx.isOwner || !viewer.user || items.length === 0) return items
  const { favorites } = tables
  const rows = await useDB().select({ id: favorites.resourceId }).from(favorites)
    .where(and(eq(favorites.userId, viewer.user.id), inArray(favorites.resourceId, items.map(item => item.id))))
  const starred = new Set(rows.map(row => row.id))
  return items.map(item => ({ ...item, starred: starred.has(item.id) }))
}

/** A star is a personal bookmark, not a change to the file: readers may set their own. */
export async function setStarred(viewer: Viewer, resourceId: string, starred: boolean) {
  const { resources, favorites } = tables
  const db = useDB()
  if (viewer.ctx.isOwner) return db.update(resources).set({ starred }).where(eq(resources.id, resourceId))
  const userId = viewer.user!.id
  if (starred) return db.insert(favorites).values({ userId, resourceId }).onConflictDoNothing()
  return db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.resourceId, resourceId)))
}

/** A reader's favorites they can still open, access being re-resolved for each one. */
export async function readerFavorites(viewer: Viewer) {
  const { favorites, resources } = tables
  const rows = await useDB().select({ resource: resources }).from(favorites)
    .innerJoin(resources, eq(favorites.resourceId, resources.id))
    .where(and(eq(favorites.userId, viewer.user!.id), notInTrash))
    .orderBy(asc(resources.nameLower))
  const items: ResourceItem[] = []
  for (const { resource } of rows) {
    const { access } = await accessOf(viewer, resource)
    if (access.read) items.push({ ...toItem(resource, { viewer, access }), starred: true })
  }
  return items
}
