import { count } from 'drizzle-orm'
import { z } from 'zod'
import { TAG_COLORS } from '#shared/utils/tags'

const bodySchema = z.object({ name: tagNameSchema, color: tagColorSchema.optional() })

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const { name, color } = await readValidatedBody(event, bodySchema.parse)
  const { tags } = tables
  const db = useDB()
  const [{ total }] = await db.select({ total: count() }).from(tags) as [{ total: number }]
  const [tag] = await db.insert(tags)
    .values({ name, nameLower: name.toLowerCase(), color: color ?? TAG_COLORS[total % TAG_COLORS.length]! })
    .returning()
    .catch(error => tagNameTaken(error, name))
  setResponseStatus(event, 201)
  return { id: tag!.id, name: tag!.name, color: tag!.color, count: 0 }
})
