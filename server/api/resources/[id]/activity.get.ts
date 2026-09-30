import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const { resource } = await requireAccess(viewer, getRouterParam(event, 'id')!, 'manage')
  const { accessEvents } = tables
  const events = await useDB().select().from(accessEvents).where(activityScope(resource)).orderBy(desc(accessEvents.id)).limit(100)
  return { stats: await activityStats(resource), events: await toActivityEvents(events) }
})
