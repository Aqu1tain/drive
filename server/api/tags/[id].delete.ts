import { eq, sql } from 'drizzle-orm'

/** Removing a tag only takes the label off the files; nothing else changes. */
export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const tag = await requireTag(getRouterParam(event, 'id')!)
  const { tags, resources } = tables
  await useDB().transaction(async (tx) => {
    await tx.update(resources)
      .set({ tagIds: sql`array_remove(${resources.tagIds}, ${tag.id}::uuid)` })
      .where(sql`${resources.tagIds} @> array[${tag.id}::uuid]`)
    await tx.delete(tags).where(eq(tags.id, tag.id))
  })
  return { ok: true }
})
