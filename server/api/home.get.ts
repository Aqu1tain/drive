import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { ActivityEvent } from '#shared/types/api'

/** "Get back to what I was working on": recent folders, recent files, what others just looked at. */
export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const { resources, accessEvents } = tables
  const db = useDB()
  const [folders, files, events] = await Promise.all([
    db.select().from(resources).where(and(eq(resources.type, 'folder'), notInTrash))
      .orderBy(desc(sql`greatest(${resources.ownerOpenedAt}, ${resources.updatedAt})`)).limit(8),
    db.select().from(resources).where(and(eq(resources.type, 'file'), notInTrash))
      .orderBy(desc(sql`greatest(${resources.ownerOpenedAt}, ${resources.updatedAt})`)).limit(12),
    db.select().from(accessEvents)
      .where(and(inArray(accessEvents.type, ['view', 'download']), isNotNull(accessEvents.resourceId)))
      .orderBy(desc(accessEvents.createdAt)).limit(8),
  ])
  const all = [...folders, ...files]
  const [summaries, locations, activity] = await Promise.all([summarizeMany(all), locationsOf(all), toActivityEvents(events)])
  const item = (r: typeof all[number]) => toItem(r, { viewer, summary: summaries.get(r.id), location: locations.get(r.id) })
  return { folders: folders.map(item), files: files.map(item), activity: activity satisfies ActivityEvent[] }
})
