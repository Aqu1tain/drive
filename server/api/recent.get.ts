import { and, desc, eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  if (!viewer.ctx.isOwner) return { items: await readerRecent(viewer) }

  const { resources, resourceOpens } = tables
  const opened = openedBy(viewer.user!.id)
  const rows = await useDB().select({ resource: resources }).from(resources)
    .leftJoin(resourceOpens, opened.join)
    .where(and(eq(resources.type, 'file'), notInTrash))
    .orderBy(desc(opened.recency))
    .limit(100)
  const items = rows.map(row => row.resource)
  const [summaries, locations] = await Promise.all([summarizeMany(items), locationsOf(items)])
  return { items: await withFavorites(viewer, items.map(item => toItem(item, { viewer, summary: summaries.get(item.id), location: locations.get(item.id) }))) }
})

async function readerRecent(viewer: Viewer) {
  const { accessEvents, resources } = tables
  const rows = await useDB().select({ resource: resources })
    .from(accessEvents)
    .innerJoin(resources, eq(accessEvents.resourceId, resources.id))
    .where(and(eq(accessEvents.userId, viewer.user!.id), eq(resources.type, 'file')))
    .groupBy(resources.id)
    .orderBy(desc(sql`max(${accessEvents.createdAt})`))
    .limit(50)
  const items = []
  for (const { resource } of rows) {
    const { access } = await accessOf(viewer, resource)
    if (access.read) items.push(toItem(resource, { viewer, access }))
  }
  return withFavorites(viewer, items)
}
