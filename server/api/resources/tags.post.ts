import { inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

const ids = z.array(z.string().uuid()).max(500)
const bodySchema = z.object({ ids: ids.min(1), add: ids.default([]), remove: ids.default([]) })

/** Adds and removes labels on a selection in one statement, leaving every other label in place. */
export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const { tags, resources } = tables
  const db = useDB()
  const known = body.add.length ? await db.select({ id: tags.id }).from(tags).where(inArray(tags.id, body.add)) : []
  if (known.length !== new Set(body.add).size) throw createError({ statusCode: 404, statusMessage: 'Étiquette introuvable' })

  const updated = await db.update(resources)
    .set({ tagIds: sql`(select coalesce(array_agg(distinct tag), '{}') from unnest(${resources.tagIds} || ${uuidArray(body.add)}) as tag where tag <> all(${uuidArray(body.remove)}))` })
    .where(inArray(resources.id, body.ids))
    .returning({ id: resources.id, tagIds: resources.tagIds })
  return { items: updated }
})
