import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { ResourceItem } from '#shared/types/api'

/** Marks the items the viewer starred. */
export async function withFavorites(viewer: Viewer, items: ResourceItem[]) {
  if (!viewer.user || items.length === 0) return items
  const { favorites } = tables
  const rows = await useDB().select({ id: favorites.resourceId }).from(favorites)
    .where(and(eq(favorites.userId, viewer.user.id), inArray(favorites.resourceId, items.map(item => item.id))))
  const starred = new Set(rows.map(row => row.id))
  return items.map(item => ({ ...item, starred: starred.has(item.id) }))
}

/** A star is a personal bookmark, not a change to the file: anyone who can read may set their own. */
export async function setStarred(viewer: Viewer, resourceId: string, starred: boolean) {
  const { favorites } = tables
  const db = useDB()
  const userId = viewer.user!.id
  if (starred) return db.insert(favorites).values({ userId, resourceId }).onConflictDoNothing()
  return db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.resourceId, resourceId)))
}

/** The viewer's favorites they can still open, access being re-resolved for each one. */
export async function favoritesOf(viewer: Viewer) {
  const { favorites, resources } = tables
  const rows = await useDB().select({ resource: resources }).from(favorites)
    .innerJoin(resources, eq(favorites.resourceId, resources.id))
    .where(and(eq(favorites.userId, viewer.user!.id), notInTrash))
    .orderBy(asc(resources.nameLower))
  const readable = []
  for (const { resource } of rows) {
    const { access } = await accessOf(viewer, resource)
    if (access.read) readable.push({ resource, access })
  }
  return readable
}

/** Records that the viewer opened something, for their "Recent". */
export async function markOpened(viewer: Viewer, resourceId: string) {
  if (!viewer.user) return
  const { resourceOpens } = tables
  const openedAt = new Date()
  await useDB().insert(resourceOpens).values({ userId: viewer.user.id, resourceId, openedAt })
    .onConflictDoUpdate({ target: [resourceOpens.userId, resourceOpens.resourceId], set: { openedAt } })
}

/** Joins each resource with when the viewer last opened it, to sort by "last worked on". */
export function openedBy(userId: string) {
  const { resourceOpens, resources } = tables
  return {
    join: and(eq(resourceOpens.resourceId, resources.id), eq(resourceOpens.userId, userId)),
    recency: sql`greatest(${resourceOpens.openedAt}, ${resources.updatedAt})`,
  }
}
