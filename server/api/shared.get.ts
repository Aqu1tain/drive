import { and, desc, sql } from 'drizzle-orm'

/** Everything the owner shared directly: the list that answers "who can see what". */
export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const { resources, accessRules } = tables
  const items = await useDB().select().from(resources)
    .where(and(notInTrash, sql`exists (select 1 from ${accessRules} where ${accessRules.resourceId} = ${resources.id})`))
    .orderBy(desc(resources.updatedAt))
  const [summaries, locations] = await Promise.all([summarizeMany(items), locationsOf(items)])
  const shared = items
    .map(item => toItem(item, { viewer, summary: summaries.get(item.id), location: locations.get(item.id) }))
    .filter(item => item.access?.level !== 'private' || !item.access.inherited)
  return { items: await withFolderPreviews(viewer, await withFavorites(viewer, shared)) }
})
