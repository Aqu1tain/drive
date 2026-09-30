import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import type { ActivityEvent } from '#shared/types/api'

/** "Get back to what I was working on": recent folders, recent files, what others just looked at. */
export default defineEventHandler(async (event) => {
  const viewer = await requireMember(event)
  if (!viewer.ctx.isOwner) return memberHome(viewer)
  const { resources, resourceOpens, accessEvents } = tables
  const db = useDB()
  const opened = openedBy(viewer.user!.id)
  const latest = (type: 'file' | 'folder', limit: number) => db.select({ resource: resources, openedAt: resourceOpens.openedAt }).from(resources)
    .leftJoin(resourceOpens, opened.join)
    .where(and(eq(resources.type, type), notInTrash))
    .orderBy(desc(opened.recency)).limit(limit)
  const [folders, files, events] = await Promise.all([
    latest('folder', 8),
    latest('file', 12),
    db.select().from(accessEvents)
      .where(and(inArray(accessEvents.type, ['view', 'download']), isNotNull(accessEvents.resourceId)))
      .orderBy(desc(accessEvents.createdAt)).limit(8),
  ])
  const all = [...folders, ...files].map(row => row.resource)
  const [summaries, locations, activity] = await Promise.all([summarizeMany(all), locationsOf(all), toActivityEvents(events)])
  const present = async (rows: typeof folders) => withFavorites(viewer, rows.map(({ resource, openedAt }) => ({
    ...toItem(resource, { viewer, summary: summaries.get(resource.id), location: locations.get(resource.id) }),
    openedAt: openedAt?.toISOString() ?? null,
  })))
  return { folders: await present(folders), files: await present(files), activity: activity satisfies ActivityEvent[] }
})

/** A member's home: what they opened lately among what they can still read. Where it sits is left out, as they may not see the folders above. */
async function memberHome(viewer: Viewer) {
  const { resources, resourceOpens } = tables
  const rows = await useDB().select({ resource: resources, openedAt: resourceOpens.openedAt }).from(resourceOpens)
    .innerJoin(resources, eq(resourceOpens.resourceId, resources.id))
    .where(and(eq(resourceOpens.userId, viewer.user!.id), notInTrash))
    .orderBy(desc(resourceOpens.openedAt)).limit(60)
  const items = []
  for (const { resource, openedAt } of rows) {
    const { access } = await accessOf(viewer, resource)
    if (access.read) items.push({ ...toItem(resource, { viewer, access }), openedAt: openedAt.toISOString() })
  }
  const marked = await withFavorites(viewer, items)
  return { folders: marked.filter(item => item.type === 'folder').slice(0, 8), files: marked.filter(item => item.type === 'file').slice(0, 12), activity: [] as ActivityEvent[] }
}
