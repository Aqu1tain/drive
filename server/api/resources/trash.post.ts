import { and, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) })

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const { ids } = await readValidatedBody(event, bodySchema.parse)
  const { resources } = tables
  const trashed = await useDB().update(resources).set({ deletedAt: new Date() })
    .where(and(inArray(resources.id, ids), isNull(resources.deletedAt)))
    .returning({ id: resources.id, name: resources.name })
  return { trashed }
})
