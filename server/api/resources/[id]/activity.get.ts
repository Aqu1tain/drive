import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const resource = await requireOwned(getRouterParam(event, 'id')!)
  const { accessEvents } = tables
  const events = await useDB().select().from(accessEvents).where(activityScope(resource)).orderBy(desc(accessEvents.id)).limit(100)
  return { stats: await activityStats(resource), events: await toActivityEvents(events) }
})
