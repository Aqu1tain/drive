import { desc, isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const { resources } = tables
  const items = await useDB().select().from(resources).where(isNotNull(resources.deletedAt)).orderBy(desc(resources.deletedAt)).limit(2000)
  const locations = await locationsOf(items)
  return { items: items.map(item => toItem(item, { viewer, location: locations.get(item.id) })) }
})
