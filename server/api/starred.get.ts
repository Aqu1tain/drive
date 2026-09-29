import { and, asc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  if (!viewer.ctx.isOwner) return { items: await readerFavorites(viewer) }
  const { resources } = tables
  const items = await useDB().select().from(resources).where(and(eq(resources.starred, true), notInTrash)).orderBy(asc(resources.nameLower))
  const [summaries, locations] = await Promise.all([summarizeMany(items), locationsOf(items)])
  return { items: items.map(item => toItem(item, { viewer, summary: summaries.get(item.id), location: locations.get(item.id) })) }
})
