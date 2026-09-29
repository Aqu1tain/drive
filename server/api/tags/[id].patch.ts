import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({ name: tagNameSchema.optional(), color: tagColorSchema.optional() })

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const tag = await requireTag(getRouterParam(event, 'id')!)
  const { name, color } = await readValidatedBody(event, bodySchema.parse)
  const { tags } = tables
  const [updated] = await useDB().update(tags)
    .set({ ...(name ? { name, nameLower: name.toLowerCase() } : {}), ...(color ? { color } : {}) })
    .where(eq(tags.id, tag.id))
    .returning()
    .catch(error => tagNameTaken(error, name ?? tag.name))
  return { id: updated!.id, name: updated!.name, color: updated!.color }
})
